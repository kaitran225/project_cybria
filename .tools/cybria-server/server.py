"""Unified Cybria AI gateway — one port (2253) for LLM, summarize, TTS, and diffusion."""

from __future__ import annotations

import asyncio
import os
import signal
import subprocess
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT.parent

HOST = os.environ.get("CYBRIA_HOST", "127.0.0.1")
PORT = int(os.environ.get("CYBRIA_PORT", "2253"))

SERVICES: dict[str, dict[str, Any]] = {
    "llm": {
        "dir": "cybria-llm",
        "internal_port": int(os.environ.get("CYBRIA_LLM_INTERNAL_PORT", "22531")),
        "env_port": "CYBRIA_LLM_PORT",
        "extra_env": {},
    },
    "summarize": {
        "dir": "cybria-summarize",
        "internal_port": int(os.environ.get("CYBRIA_SUMMARIZE_INTERNAL_PORT", "22532")),
        "env_port": "CYBRIA_SUMMARIZE_PORT",
        "extra_env": {},
    },
    "tts": {
        "dir": "cybria-tts",
        "internal_port": int(os.environ.get("CYBRIA_TTS_INTERNAL_PORT", "22533")),
        "env_port": "CYBRIA_TTS_PORT",
        "extra_env": {},
    },
    "image": {
        "dir": "qwen-image",
        "internal_port": int(os.environ.get("CYBRIA_IMAGE_INTERNAL_PORT", "22534")),
        "env_port": "QWEN_IMAGE_PORT",
        "extra_env": {
            "QWEN_IMAGE_MAX_SIDE": os.environ.get("QWEN_IMAGE_MAX_SIDE", "512"),
            "QWEN_IMAGE_LIGHTNING": os.environ.get("QWEN_IMAGE_LIGHTNING", "1"),
            "QWEN_IMAGE_COMPILE": os.environ.get("QWEN_IMAGE_COMPILE", "0"),
        },
    },
}

_procs: dict[str, subprocess.Popen[Any]] = {}
_log_threads: dict[str, threading.Thread] = {}
_client: httpx.AsyncClient | None = None


def _python_exe(tools_dir: Path) -> Path:
    win = tools_dir / ".venv" / "Scripts" / "python.exe"
    if win.is_file():
        return win
    return tools_dir / ".venv" / "bin" / "python"


def _model_path_env() -> dict[str, str]:
    try:
        llm_path = str(TOOLS / "cybria-llm")
        if llm_path not in sys.path:
            sys.path.insert(0, llm_path)
        from model_paths import ensure_model_dirs, model_path_env as mpe

        ensure_model_dirs()
        return {k: str(v) for k, v in mpe().items()}
    except Exception:
        return {}


def _service_runtime_env() -> dict[str, str]:
    return {
        "PYTHONUNBUFFERED": "1",
        "PYTHONIOENCODING": "utf-8",
        "FORCE_COLOR": "1",
        "HF_HUB_ENABLE_HF_TRANSFER": os.environ.get("HF_HUB_ENABLE_HF_TRANSFER", "1"),
    }


def _drain_service_logs(name: str, proc: subprocess.Popen[Any]) -> None:
    stream = proc.stdout
    if stream is None:
        return
    for raw in stream:
        line = raw.rstrip()
        if line:
            print(f"[{name}] {line}", flush=True)


def start_service(name: str) -> None:
    cfg = SERVICES[name]
    tools_dir = TOOLS / cfg["dir"]
    py = _python_exe(tools_dir)
    if not py.is_file():
        raise FileNotFoundError(f"Missing venv for {name}: {py}")

    env = {**os.environ, **_model_path_env(), **_service_runtime_env()}
    env[cfg["env_port"]] = str(cfg["internal_port"])
    env.update(cfg.get("extra_env", {}))

    proc = _procs.get(name)
    if proc is not None and proc.poll() is None:
        return

    print(f"[cybria-server] starting {name} on 127.0.0.1:{cfg['internal_port']}", flush=True)
    proc = subprocess.Popen(
        [str(py), "-u", "server.py"],
        cwd=str(tools_dir),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    _procs[name] = proc
    thread = threading.Thread(
        target=_drain_service_logs,
        args=(name, proc),
        daemon=True,
        name=f"cybria-log-{name}",
    )
    _log_threads[name] = thread
    thread.start()


def start_all_services() -> None:
    for name in SERVICES:
        try:
            start_service(name)
        except Exception as exc:
            print(f"[cybria-server] failed to start {name}: {exc}")


def stop_all_services() -> None:
    for name, proc in list(_procs.items()):
        if proc.poll() is None:
            print(f"[cybria-server] stopping {name}")
            proc.terminate()
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()
        _procs.pop(name, None)
    _log_threads.clear()


def _service_base(name: str) -> str:
    port = SERVICES[name]["internal_port"]
    return f"http://127.0.0.1:{port}"


async def _wait_for_service(name: str, timeout: float = 120.0) -> bool:
    deadline = time.time() + timeout
    url = f"{_service_base(name)}/health"
    assert _client is not None
    while time.time() < deadline:
        proc = _procs.get(name)
        if proc is not None and proc.poll() is not None:
            return False
        try:
            r = await _client.get(url, timeout=3.0)
            if r.status_code < 500:
                return True
        except Exception:
            pass
        await asyncio.sleep(0.5)
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client
    _client = httpx.AsyncClient(timeout=None)
    start_all_services()
    yield
    if _client:
        await _client.aclose()
        _client = None
    stop_all_services()


app = FastAPI(title="cybria-server", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def root_health() -> dict[str, Any]:
    statuses: dict[str, Any] = {}
    for name in SERVICES:
        try:
            assert _client is not None
            r = await _client.get(f"{_service_base(name)}/health", timeout=5.0)
            statuses[name] = r.json() if r.status_code == 200 else {"error": r.status_code}
        except Exception as exc:
            statuses[name] = {"error": str(exc)}
    running = any(p.poll() is None for p in _procs.values())
    return {"ready": running, "port": PORT, "services": statuses}


@app.post("/services/{name}/start")
async def api_start_service(name: str) -> dict[str, Any]:
    if name not in SERVICES:
        raise HTTPException(status_code=404, detail=f"unknown service {name}")
    start_service(name)
    ok = await _wait_for_service(name, timeout=60.0)
    return {"ok": ok, "service": name}


@app.post("/services/{name}/stop")
async def api_stop_service(name: str) -> dict[str, Any]:
    if name not in SERVICES:
        raise HTTPException(status_code=404, detail=f"unknown service {name}")
    proc = _procs.get(name)
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
    _procs.pop(name, None)
    _log_threads.pop(name, None)
    return {"ok": True, "service": name}


async def _proxy(name: str, path: str, request: Request) -> Response:
    proc = _procs.get(name)
    if proc is None or proc.poll() is not None:
        start_service(name)
        await _wait_for_service(name, timeout=30.0)

    base = _service_base(name)
    target = f"{base}/{path}" if path else f"{base}/"
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}

    assert _client is not None
    upstream = await _client.request(
        request.method,
        target,
        params=request.query_params,
        content=body,
        headers=headers,
    )
    skip = {"content-encoding", "content-length", "transfer-encoding"}
    out_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in skip}
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=out_headers,
        media_type=upstream.headers.get("content-type"),
    )


def _make_proxy(name: str):
    async def root(request: Request) -> Response:
        return await _proxy(name, "", request)

    async def path(request: Request, path: str) -> Response:
        return await _proxy(name, path, request)

    return root, path


for _svc in SERVICES:
    _root, _path = _make_proxy(_svc)
    app.add_api_route(f"/{_svc}", _root, methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    app.add_api_route(
        f"/{_svc}/{{path:path}}",
        _path,
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    )


def _handle_signal(*_args: Any) -> None:
    stop_all_services()
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)
    print(f"[cybria-server] gateway starting on http://{HOST}:{PORT}", flush=True)
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
