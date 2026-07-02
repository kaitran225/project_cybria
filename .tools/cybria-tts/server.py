"""Cybria TTS API — manages vllm-omni for Higgs TTS."""

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

ensure_model_dirs()

HOST = os.environ.get("CYBRIA_TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CYBRIA_TTS_PORT", "8792"))
INNER_PORT = int(os.environ.get("CYBRIA_TTS_INNER_PORT", "18792"))
MODEL_REPO = os.environ.get("CYBRIA_TTS_MODEL", "bosonai/higgs-tts-3-4b")

app = FastAPI(title="cybria-tts", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_proc: subprocess.Popen[Any] | None = None
_error: str | None = None


class TtsRequest(BaseModel):
    text: str
    voice: str = ""
    speed: float = 1.0


def _inner_base() -> str:
    return f"http://127.0.0.1:{INNER_PORT}"


def _is_running() -> bool:
    return _proc is not None and _proc.poll() is None


def _start_vllm() -> None:
    global _proc, _error
    if _is_running():
        return
    local = tts_dir() / "higgs-tts-3-4b"
    model_ref = str(local) if local.is_dir() and any(local.iterdir()) else MODEL_REPO
    venv_scripts = Path(sys.executable).parent
    vllm = venv_scripts / "vllm.exe"
    cmd = [
        str(vllm) if vllm.is_file() else "vllm-omni",
        "serve",
        model_ref,
        "--host",
        "127.0.0.1",
        "--port",
        str(INNER_PORT),
        "--trust-remote-code",
        "--omni",
    ]
    print(f"[tts] starting: {' '.join(cmd)}")
    try:
        _proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
    except FileNotFoundError as exc:
        _error = "vllm-omni not installed. Run pip install vllm-omni in cybria-tts venv."
        raise RuntimeError(_error) from exc

    deadline = time.time() + 300
    while time.time() < deadline:
        if _proc.poll() is not None:
            out = _proc.stdout.read(2000) if _proc.stdout else ""
            _error = f"vllm-omni exited: {out[:500]}"
            raise RuntimeError(_error)
        try:
            r = httpx.get(f"{_inner_base()}/health", timeout=2.0)
            if r.status_code == 200:
                _error = None
                return
        except Exception:
            pass
        time.sleep(1.0)
    _error = "vllm-omni startup timeout"
    raise RuntimeError(_error)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ready": _is_running(),
        "model": MODEL_REPO,
        "error": _error,
        "inner_url": _inner_base() if _is_running() else None,
    }


@app.post("/models/load")
def load_model() -> dict[str, Any]:
    try:
        _start_vllm()
        return {"ok": True, "model": MODEL_REPO}
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

    payload = {
        "model": MODEL_REPO,
        "input": text,
        "voice": req.voice or "default",
        "response_format": "wav",
        "speed": req.speed,
    }
    try:
        r = httpx.post(
            f"{_inner_base()}/v1/audio/speech",
            json=payload,
            timeout=300.0,
        )
        if r.status_code == 200:
            return Response(content=r.content, media_type="audio/wav")
        # fallback: return JSON with base64 if API differs
        data = r.json()
        if "audio" in data:
            raw = base64.b64decode(data["audio"])
            return Response(content=raw, media_type="audio/wav")
        raise HTTPException(status_code=r.status_code, detail=r.text[:500])
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/download")
def download() -> dict[str, Any]:
    from huggingface_hub import snapshot_download

    dest = tts_dir() / "higgs-tts-3-4b"
    dest.mkdir(parents=True, exist_ok=True)
    try:
        path = snapshot_download(
            repo_id=MODEL_REPO,
            local_dir=str(dest),
            local_dir_use_symlinks=False,
        )
        return {"ok": True, "path": path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
