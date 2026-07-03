"""Manage llama.cpp server subprocess for a loaded GGUF model."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any

import httpx

from models import get_model, find_gguf

INNER_HOST = os.environ.get("CYBRIA_LLM_INNER_HOST", "127.0.0.1")
INNER_PORT = int(os.environ.get("CYBRIA_LLM_INNER_PORT", "18790"))
N_GPU_LAYERS = int(os.environ.get("CYBRIA_LLM_N_GPU_LAYERS", "99"))
CTX_SIZE = int(os.environ.get("CYBRIA_LLM_CTX", "8192"))
READY_TIMEOUT = float(os.environ.get("CYBRIA_LLM_READY_TIMEOUT", "600"))

_ERROR_LINE = re.compile(
    r"error|failed|fatal|exception|traceback|cuda|oom|not found|invalid",
    re.IGNORECASE,
)
_NOISE_LINE = re.compile(
    r"^llama_model_loader:\s*-\s*kv\s+\d+:",
    re.IGNORECASE,
)


def _subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")
    return env


def _summarize_output(lines: deque[str], *, max_chars: int = 1200) -> str:
    if not lines:
        return "(no subprocess output)"
    important = [ln for ln in lines if _ERROR_LINE.search(ln)]
    if important:
        body = "\n".join(important[-10:])
    else:
        tail = [ln for ln in list(lines)[-25:] if not _NOISE_LINE.match(ln.strip())]
        if not tail:
            tail = list(lines)[-8:]
        body = "\n".join(tail)
    body = body.strip()
    if len(body) > max_chars:
        body = "…\n" + body[-max_chars:]
    return body or "(no useful output)"


class LlamaServerProcess:
    def __init__(self) -> None:
        self.proc: subprocess.Popen[Any] | None = None
        self.model_id: str | None = None
        self.gguf_path: str | None = None
        self._output_lines: deque[str] = deque(maxlen=400)
        self._reader: threading.Thread | None = None

    @property
    def inner_base(self) -> str:
        return f"http://{INNER_HOST}:{INNER_PORT}"

    def is_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def _llama_server_cmd(self, gguf: Path) -> list[str]:
        venv_scripts = Path(sys.executable).parent
        exe = venv_scripts / "llama-server.exe"
        if exe.is_file():
            return [
                str(exe),
                "--model",
                str(gguf),
                "--host",
                INNER_HOST,
                "--port",
                str(INNER_PORT),
                "--ctx-size",
                str(CTX_SIZE),
                "-ngl",
                str(N_GPU_LAYERS),
            ]
        return [
            sys.executable,
            "-m",
            "llama_cpp.server",
            "--model",
            str(gguf),
            "--host",
            INNER_HOST,
            "--port",
            str(INNER_PORT),
            "--n_ctx",
            str(CTX_SIZE),
            "--n_gpu_layers",
            str(N_GPU_LAYERS),
        ]

    def _capture_line(self, line: str) -> None:
        self._output_lines.append(line)
        print(line, flush=True)

    def _start_output_reader(self, proc: subprocess.Popen[Any]) -> None:
        def _read() -> None:
            if not proc.stdout:
                return
            try:
                for raw in proc.stdout:
                    self._capture_line(raw.rstrip("\r\n"))
            except Exception:
                pass

        self._reader = threading.Thread(target=_read, daemon=True)
        self._reader.start()

    def stop(self) -> None:
        if not self.proc:
            return
        try:
            self.proc.terminate()
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        except Exception:
            pass
        self.proc = None
        self.model_id = None
        self.gguf_path = None
        self._reader = None

    def wait_ready(self, timeout: float = READY_TIMEOUT) -> bool:
        """llama_cpp.server exposes /v1/models, not /health."""
        deadline = time.time() + timeout
        url = f"{self.inner_base}/v1/models"
        while time.time() < deadline:
            if self.proc and self.proc.poll() is not None:
                return False
            try:
                r = httpx.get(url, timeout=3.0)
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            time.sleep(1.0)
        return False

    def load(self, model_id: str) -> dict[str, Any]:
        if self.is_running() and self.model_id == model_id:
            return {
                "ok": True,
                "model_id": model_id,
                "gguf_path": self.gguf_path,
                "already_loaded": True,
            }

        gguf = find_gguf(model_id)
        if not gguf:
            raise FileNotFoundError(
                f"GGUF not found for {model_id}. Run: python download.py {model_id}"
            )

        self.stop()
        self._output_lines.clear()
        cmd = self._llama_server_cmd(gguf)
        print(f"[llama] starting: {' '.join(cmd)}", flush=True)
        self.proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=_subprocess_env(),
        )
        self._start_output_reader(self.proc)
        self.model_id = model_id
        self.gguf_path = str(gguf)

        if not self.wait_ready():
            code = self.proc.poll() if self.proc else None
            err = _summarize_output(self._output_lines)
            self.stop()
            hint = f" (exit {code})" if code is not None else " (timed out)"
            raise RuntimeError(f"llama-server failed to start{hint}.\n{err}")

        print(f"[llama] ready on {self.inner_base}", flush=True)
        return {
            "ok": True,
            "model_id": model_id,
            "gguf_path": self.gguf_path,
            "inner_url": self.inner_base,
        }

    def status(self) -> dict[str, Any]:
        return {
            "running": self.is_running(),
            "model_id": self.model_id,
            "gguf_path": self.gguf_path,
            "inner_url": self.inner_base if self.is_running() else None,
        }
