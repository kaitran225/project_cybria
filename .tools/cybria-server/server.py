"""Unified Cybria AI gateway — one port (2253) for LLM, summarize, TTS, and diffusion."""

from __future__ import annotations

import asyncio
import json
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
        "dir": "cybria-diffuser",
        "internal_port": int(os.environ.get("CYBRIA_IMAGE_INTERNAL_PORT", "22534")),
        "env_port": "QWEN_IMAGE_PORT",
        "extra_env": {
            "QWEN_IMAGE_MAX_SIDE": os.environ.get("QWEN_IMAGE_MAX_SIDE", "512"),
            "QWEN_IMAGE_LIGHTNING": os.environ.get("QWEN_IMAGE_LIGHTNING", "1"),
            "QWEN_IMAGE_COMPILE": os.environ.get("QWEN_IMAGE_COMPILE", "0"),
            "QWEN_IMAGE_WARMUP": "0",
        },
    },
}

_procs: dict[str, subprocess.Popen[Any]] = {}
_log_threads: dict[str, threading.Thread] = {}
_client: httpx.AsyncClient | None = None

# Paths that may run for a long time (model load, image gen, LLM chat, etc.)
_LONG_RUNNING = frozenset(
    {
        "generate",
        "models/load",
        "download",
        "chat",
        "completions",
        "summarize",
        "transcribe",
        "synthesize",
    }
)


def _proxy_timeout(path: str, method: str) -> float | None:
    """Return httpx timeout seconds, or None for no read limit."""
    norm = path.strip("/").lower()
    if method.upper() == "POST" and any(seg in norm for seg in _LONG_RUNNING):
        return None
    if norm == "health" or norm.endswith("/health"):
        return 10.0
    return 120.0


def _python_exe(tools_dir: Path) -> Path:
    candidates = [
        tools_dir / ".venv" / "Scripts" / "python.exe",
        tools_dir / ".venv" / "bin" / "python",
        tools_dir / ".venv" / "bin" / "python3",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return candidates[0]


def _service_running(name: str) -> bool:
    proc = _procs.get(name)
    return proc is not None and proc.poll() is None


def _model_path_env() -> dict[str, str]:
    try:
        tools_path = str(TOOLS)
        if tools_path not in sys.path:
            sys.path.insert(0, tools_path)
        from model_paths_lib import ensure_model_dirs, model_path_env as mpe

        ensure_model_dirs()
        return {k: str(v) for k, v in mpe().items()}
    except Exception:
        return {}


def _service_runtime_env() -> dict[str, str]:
    return {
        "PYTHONUNBUFFERED": "1",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
        "FORCE_COLOR": "1",
        "HF_XET_HIGH_PERFORMANCE": os.environ.get("HF_XET_HIGH_PERFORMANCE", "1"),
    }


def _drain_service_logs(name: str, proc: subprocess.Popen[Any]) -> None:
    """Read child output char-by-char so tqdm '\\r' progress bars are emitted live.

    Progress-style lines (from '\\r' repaint or containing a tqdm bar) are throttled
    to ~1/sec and de-duplicated so a slow download can't flood the terminal.
    """
    stream = proc.stdout
    if stream is None:
        return
    buf: list[str] = []
    last_progress_emit = 0.0
    last_progress_text = ""

    def _is_progress(line: str, from_cr: bool) -> bool:
        if from_cr:
            return True
        return "%|" in line or line.endswith("B/s]") or line.endswith("it/s]")

    def _emit(seg: str, from_cr: bool) -> None:
        nonlocal last_progress_emit, last_progress_text
        line = seg.rstrip("\r\n")
        if not line:
            return
        if _is_progress(line, from_cr):
            now = time.time()
            done = "100%" in line
            # collapse consecutive identical frames and rate-limit repaints
            if not done:
                if line == last_progress_text:
                    return
                if now - last_progress_emit < 1.0:
                    return
            last_progress_emit = now
            last_progress_text = line
        print(f"[{name}] {line}", flush=True)

    try:
        while True:
            ch = stream.read(1)
            if ch == "":
                break
            if ch in ("\r", "\n"):
                _emit("".join(buf), ch == "\r")
                buf.clear()
            else:
                buf.append(ch)
        if buf:
            _emit("".join(buf), False)
    except Exception as exc:
        print(f"[cybria-server] log drain for {name} ended: {exc}", flush=True)


def _port_in_use(port: int) -> bool:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _free_port(port: int) -> None:
    """Kill whatever process is bound to a local port (stale service from a prior run)."""
    if not _port_in_use(port):
        return
    print(f"[cybria-server] port {port} busy — clearing stale listener", flush=True)
    try:
        if sys.platform == "win32":
            out = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True,
                text=True,
                timeout=5,
            ).stdout
            pids: set[str] = set()
            needle = f":{port}"
            for line in out.splitlines():
                if needle in line and "LISTENING" in line:
                    pid = line.split()[-1]
                    if pid.isdigit() and pid != "0":
                        pids.add(pid)
            for pid in pids:
                subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True, timeout=5)
                print(f"[cybria-server] killed stale pid {pid} on port {port}", flush=True)
        else:
            out = subprocess.run(
                ["lsof", "-ti", f"tcp:{port}"], capture_output=True, text=True, timeout=5
            ).stdout
            for pid in out.split():
                subprocess.run(["kill", "-9", pid], capture_output=True, timeout=5)
    except Exception as exc:
        print(f"[cybria-server] could not free port {port}: {exc}", flush=True)
    time.sleep(1.0)


def start_service(name: str) -> None:
    cfg = SERVICES[name]
    tools_dir = TOOLS / cfg["dir"]
    py = _python_exe(tools_dir)
    if not py.is_file():
        raise FileNotFoundError(f"Missing venv for {name}: {py} (run Install on the {name} card)")

    env = {**os.environ, **_model_path_env(), **_service_runtime_env()}
    env[cfg["env_port"]] = str(cfg["internal_port"])
    env.update(cfg.get("extra_env", {}))

    proc = _procs.get(name)
    if proc is not None and proc.poll() is None:
        return

    _free_port(cfg["internal_port"])

    print(f"[cybria-server] starting {name} on 127.0.0.1:{cfg['internal_port']}", flush=True)
    proc = subprocess.Popen(
        [str(py), "-u", "server.py"],
        cwd=str(tools_dir),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
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


def stop_service(name: str) -> None:
    proc = _procs.get(name)
    if proc is not None and proc.poll() is None:
        print(f"[cybria-server] stopping {name}", flush=True)
        _terminate_process_tree(proc)
    _procs.pop(name, None)
    _log_threads.pop(name, None)


def _terminate_process_tree(proc: subprocess.Popen[Any]) -> None:
    """Stop a service and its children (e.g. llama-server under cybria-llm)."""
    if proc.poll() is not None:
        return
    pid = proc.pid
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                timeout=15,
            )
            return
        proc.terminate()
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
    except Exception as exc:
        print(f"[cybria-server] kill pid {pid} failed: {exc}", flush=True)
        try:
            proc.kill()
        except Exception:
            pass


def stop_all_services() -> None:
    for name in list(_procs):
        stop_service(name)


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


def _stopped_payload(name: str) -> dict[str, Any]:
    return {"stopped": True, "ready": False, "error": f"{name} not running — click Start"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client
    _client = httpx.AsyncClient(timeout=None)
    print("[cybria-server] gateway ready (services start on demand)", flush=True)
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
        if not _service_running(name):
            statuses[name] = _stopped_payload(name)
            continue
        try:
            assert _client is not None
            r = await _client.get(f"{_service_base(name)}/health", timeout=5.0)
            statuses[name] = r.json() if r.status_code == 200 else {"error": r.status_code}
        except Exception as exc:
            statuses[name] = {"loading": True, "ready": False, "error": str(exc)}
    return {"ready": True, "port": PORT, "services": statuses}


@app.post("/services/{name}/start")
async def api_start_service(name: str) -> dict[str, Any]:
    if name not in SERVICES:
        raise HTTPException(status_code=404, detail=f"unknown service {name}")
    try:
        start_service(name)
    except Exception as exc:
        print(f"[cybria-server] start {name} failed: {exc}", flush=True)
        return {"ok": False, "service": name, "error": str(exc)}
    ok = await _wait_for_service(name, timeout=120.0)
    err = None if ok else f"{name} did not become healthy in 120s (check its logs / venv)"
    return {"ok": ok, "service": name, "error": err}


@app.post("/services/{name}/stop")
async def api_stop_service(name: str) -> dict[str, Any]:
    if name not in SERVICES:
        raise HTTPException(status_code=404, detail=f"unknown service {name}")
    stop_service(name)
    return {"ok": True, "service": name}


@app.post("/shutdown")
async def api_shutdown() -> dict[str, Any]:
    """Stop all services and exit the gateway (used when Obsidian closes)."""
    print("[cybria-server] shutdown requested", flush=True)
    stop_all_services()

    def _exit_gateway() -> None:
        time.sleep(0.2)
        os._exit(0)

    threading.Thread(target=_exit_gateway, daemon=True, name="cybria-shutdown").start()
    return {"ok": True}


async def _proxy(name: str, path: str, request: Request) -> Response:
    if not _service_running(name):
        body = json.dumps(_stopped_payload(name))
        return Response(content=body, status_code=503, media_type="application/json")

    base = _service_base(name)
    target = f"{base}/{path}" if path else f"{base}/"
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    timeout = _proxy_timeout(path, request.method)

    assert _client is not None
    try:
        upstream = await _client.request(
            request.method,
            target,
            params=request.query_params,
            content=body,
            headers=headers,
            timeout=timeout,
        )
    except httpx.ConnectError:
        payload = json.dumps({"error": f"{name} unreachable", "loading": True, "ready": False})
        return Response(content=payload, status_code=503, media_type="application/json")
    except (httpx.ReadError, httpx.RemoteProtocolError) as exc:
        payload = json.dumps(
            {
                "error": f"{name} connection lost during request",
                "detail": str(exc),
                "loading": True,
                "ready": False,
            }
        )
        return Response(content=payload, status_code=503, media_type="application/json")
    except httpx.ReadTimeout:
        payload = json.dumps(
            {
                "detail": (
                    f"{name} timed out waiting for a response"
                    + (f" (proxy limit {timeout}s)" if timeout else " — generation may still be running upstream")
                )
            }
        )
        return Response(content=payload, status_code=504, media_type="application/json")
    except httpx.WriteTimeout:
        payload = json.dumps({"detail": f"{name} timed out sending request body"})
        return Response(content=payload, status_code=504, media_type="application/json")

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
    uvicorn.run(app, host=HOST, port=PORT, log_level="info", access_log=False)
