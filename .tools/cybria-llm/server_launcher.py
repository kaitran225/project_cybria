"""Manage llama.cpp server subprocess for a loaded GGUF model."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

from models import DEFAULT_MODEL_ID, find_gguf, get_model

INNER_HOST = os.environ.get("CYBRIA_LLM_INNER_HOST", "127.0.0.1")
INNER_PORT = int(os.environ.get("CYBRIA_LLM_INNER_PORT", "18790"))
N_GPU_LAYERS = int(os.environ.get("CYBRIA_LLM_N_GPU_LAYERS", "99"))
CTX_SIZE = int(os.environ.get("CYBRIA_LLM_CTX", "8192"))


class LlamaServerProcess:
    def __init__(self) -> None:
        self.proc: subprocess.Popen[Any] | None = None
        self.model_id: str | None = None
        self.gguf_path: str | None = None

    @property
    def inner_base(self) -> str:
        return f"http://{INNER_HOST}:{INNER_PORT}"

    def is_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def _python_exe(self) -> str:
        return sys.executable

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
            self._python_exe(),
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

    def wait_ready(self, timeout: float = 120.0) -> bool:
        deadline = time.time() + timeout
        url = f"{self.inner_base}/health"
        while time.time() < deadline:
            if self.proc and self.proc.poll() is not None:
                return False
            try:
                r = httpx.get(url, timeout=2.0)
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            time.sleep(0.5)
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
            spec = get_model(model_id)
            raise FileNotFoundError(
                f"GGUF not found for {model_id}. Run: python download.py {model_id}"
            )

        self.stop()
        cmd = self._llama_server_cmd(gguf)
        print(f"[llama] starting: {' '.join(cmd)}")
        self.proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self.model_id = model_id
        self.gguf_path = str(gguf)

        if not self.wait_ready():
            err = ""
            if self.proc and self.proc.stdout:
                try:
                    err = self.proc.stdout.read(2000) or ""
                except Exception:
                    pass
            self.stop()
            raise RuntimeError(f"llama-server failed to start. {err[:500]}")

        return {
            "ok": True,
            "model_id": model_id,
            "gguf_path": self.gguf_path,
            "inner_url": self.inner_base,
        }

    def load_default(self) -> dict[str, Any]:
        return self.load(DEFAULT_MODEL_ID)

    def status(self) -> dict[str, Any]:
        return {
            "running": self.is_running(),
            "model_id": self.model_id,
            "gguf_path": self.gguf_path,
            "inner_url": self.inner_base if self.is_running() else None,
        }
