"""Cybria TTS API — manages vllm-omni for MOSS-TTS-Nano (and optional Higgs)."""

from __future__ import annotations

import base64
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from model_paths import ensure_model_dirs, tts_dir
from models import DEFAULT_MODEL_ID, DEFAULT_VOICE, get_model, storage_dir_name

ensure_model_dirs()

HOST = os.environ.get("CYBRIA_TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CYBRIA_TTS_PORT", "8792"))
INNER_PORT = int(os.environ.get("CYBRIA_TTS_INNER_PORT", "18792"))
ACTIVE_MODEL_ID = os.environ.get("CYBRIA_TTS_MODEL_ID", DEFAULT_MODEL_ID)
GPU_MEMORY_UTIL = os.environ.get("CYBRIA_TTS_GPU_MEMORY_UTILIZATION", "0.3")

app = FastAPI(title="cybria-tts", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_proc: subprocess.Popen[Any] | None = None
_error: str | None = None
_active = get_model(ACTIVE_MODEL_ID)


class TtsRequest(BaseModel):
    text: str
    voice: str = ""
    speed: float = 1.0


class LoadRequest(BaseModel):
    model_id: str = Field(default=DEFAULT_MODEL_ID)


class DownloadRequest(BaseModel):
    model_id: str = Field(default=DEFAULT_MODEL_ID)


def _inner_base() -> str:
    return f"http://127.0.0.1:{INNER_PORT}"


def _is_running() -> bool:
    return _proc is not None and _proc.poll() is None


def _local_model_path(model_id: str) -> Path:
    return tts_dir() / storage_dir_name(model_id)


def _model_ref(spec: Any) -> str:
    local = _local_model_path(spec.id)
    if local.is_dir() and any(local.iterdir()):
        return str(local)
    return spec.repo_id


def _vllm_cmd(model_ref: str) -> list[str]:
    venv_scripts = Path(sys.executable).parent
    vllm = venv_scripts / "vllm.exe"
    bin_name = str(vllm) if vllm.is_file() else "vllm"
    cmd = [
        bin_name,
        "serve",
        model_ref,
        "--host",
        "127.0.0.1",
        "--port",
        str(INNER_PORT),
        "--omni",
    ]
    if GPU_MEMORY_UTIL:
        cmd.extend(["--gpu-memory-utilization", GPU_MEMORY_UTIL])
    if _active.id == "higgs-tts-3-4b":
        cmd.append("--trust-remote-code")
    return cmd


def _stop_vllm() -> None:
    global _proc
    if _proc is None:
        return
    if _proc.poll() is None:
        _proc.terminate()
        try:
            _proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _proc.kill()
    _proc = None


def _start_vllm() -> None:
    global _proc, _error
    if _is_running():
        return
    model_ref = _model_ref(_active)
    cmd = _vllm_cmd(model_ref)
    print(f"[tts] starting {_active.id}: {' '.join(cmd)}", flush=True)
    try:
        _proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
    except FileNotFoundError as exc:
        _error = "vllm not installed. Run: pip install vllm-omni (in cybria-tts venv)"
        raise RuntimeError(_error) from exc

    deadline = time.time() + 300
    while time.time() < deadline:
        if _proc.poll() is not None:
            out = _proc.stdout.read(4000) if _proc.stdout else ""
            _error = f"vllm exited: {out[:800]}"
            raise RuntimeError(_error)
        try:
            r = httpx.get(f"{_inner_base()}/health", timeout=2.0)
            if r.status_code == 200:
                _error = None
                print(f"[tts] ready — {_active.repo_id}", flush=True)
                return
        except Exception:
            pass
        time.sleep(1.0)
    _error = "vllm startup timeout (5 min)"
    raise RuntimeError(_error)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ready": _is_running(),
        "model_id": _active.id,
        "model": _active.repo_id,
        "voice_default": _active.default_voice,
        "error": _error,
        "inner_url": _inner_base() if _is_running() else None,
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    from models import MODELS

    return {
        "default": DEFAULT_MODEL_ID,
        "active": _active.id,
        "models": [
            {
                "id": m.id,
                "name": m.name,
                "repo_id": m.repo_id,
                "size_gb": m.size_gb,
                "runnable_local": m.runnable_local,
                "default_voice": m.default_voice,
                "note": m.note,
            }
            for m in MODELS
        ],
    }


@app.post("/models/load")
def load_model(req: LoadRequest | None = None) -> dict[str, Any]:
    global _active
    target = get_model(req.model_id if req else DEFAULT_MODEL_ID)
    if target.id != _active.id:
        _stop_vllm()
        _active = target
    elif _is_running():
        return {"ok": True, "model_id": _active.id, "model": _active.repo_id}
    try:
        _start_vllm()
        return {"ok": True, "model_id": _active.id, "model": _active.repo_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tts")
def synthesize(req: TtsRequest) -> Response:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if not _is_running():
        try:
            _start_vllm()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    voice = req.voice.strip() or _active.default_voice or DEFAULT_VOICE
    payload: dict[str, Any] = {
        "model": _active.repo_id,
        "input": text,
        "voice": voice,
        "response_format": "wav",
    }
    if req.speed != 1.0:
        payload["speed"] = req.speed
    try:
        r = httpx.post(
            f"{_inner_base()}/v1/audio/speech",
            json=payload,
            timeout=300.0,
        )
        if r.status_code == 200:
            return Response(content=r.content, media_type="audio/wav")
        data = r.json()
        if "audio" in data:
            raw = base64.b64decode(data["audio"])
            return Response(content=raw, media_type="audio/wav")
        raise HTTPException(status_code=r.status_code, detail=r.text[:500])
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/download")
def download(req: DownloadRequest | None = None) -> dict[str, Any]:
    from huggingface_hub import snapshot_download

    spec = get_model(req.model_id if req else DEFAULT_MODEL_ID)
    dest = _local_model_path(spec.id)
    dest.mkdir(parents=True, exist_ok=True)
    try:
        path = snapshot_download(repo_id=spec.repo_id, local_dir=str(dest))
        return {"ok": True, "model_id": spec.id, "path": path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from cybria_log import quiet_uvicorn

    quiet_uvicorn()
    uvicorn.run(app, host=HOST, port=PORT, log_level="info", access_log=False)
