"""Cybria LLM API — manages llama-server and proxies OpenAI chat."""

from __future__ import annotations

import os
import sys
import threading
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from download import download_model
from model_paths import ensure_model_dirs
from models import DEFAULT_MODEL_ID, model_catalog
from server_launcher import LlamaServerProcess

ensure_model_dirs()

HOST = os.environ.get("CYBRIA_LLM_HOST", "127.0.0.1")
PORT = int(os.environ.get("CYBRIA_LLM_PORT", "8790"))

app = FastAPI(title="cybria-llm", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_llama = LlamaServerProcess()
_load_lock = threading.Lock()
_loading = False
_load_error: str | None = None


class LoadRequest(BaseModel):
    model_id: str = Field(default=DEFAULT_MODEL_ID)


class DownloadRequest(BaseModel):
    model_id: str
    quant: str = ""


@app.get("/health")
def health() -> dict[str, Any]:
    st = _llama.status()
    ready = st["running"] and not _loading
    return {
        "ready": ready,
        "loading": _loading,
        "model_id": st.get("model_id"),
        "gguf_path": st.get("gguf_path"),
        "error": _load_error,
        "inner_url": st.get("inner_url"),
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    return {
        "default": DEFAULT_MODEL_ID,
        "models": model_catalog(),
    }


@app.post("/models/load")
def load_model(req: LoadRequest) -> dict[str, Any]:
    global _loading, _load_error
    with _load_lock:
        _loading = True
        _load_error = None
        try:
            result = _llama.load(req.model_id)
            return result
        except Exception as exc:
            _load_error = str(exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        finally:
            _loading = False


@app.post("/download")
def download(req: DownloadRequest) -> dict[str, Any]:
    try:
        path = download_model(req.model_id, req.quant or None)
        return {"ok": True, "path": path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_openai(path: str, request: Request):
    if not _llama.is_running():
        raise HTTPException(
            status_code=503,
            detail="No model loaded. POST /models/load first.",
        )
    inner = f"{_llama.inner_base}/v1/{path}"
    body = await request.body()
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }

    client = httpx.AsyncClient(timeout=None)
    try:
        if request.method == "POST" and path == "chat/completions":
            stream = False
            try:
                import json

                data = json.loads(body) if body else {}
                stream = bool(data.get("stream"))
            except Exception:
                pass

            if stream:
                req = client.build_request(
                    request.method,
                    inner,
                    headers=headers,
                    content=body,
                )
                r = await client.send(req, stream=True)

                async def gen():
                    try:
                        async for chunk in r.aiter_bytes():
                            yield chunk
                    finally:
                        await r.aclose()
                        await client.aclose()

                return StreamingResponse(
                    gen(),
                    status_code=r.status_code,
                    media_type=r.headers.get("content-type", "text/event-stream"),
                )

        r = await client.request(
            request.method,
            inner,
            headers=headers,
            content=body,
        )
        return JSONResponse(content=r.json(), status_code=r.status_code)
    except httpx.HTTPError as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _auto_load() -> None:
    global _loading, _load_error
    from models import find_gguf

    if not find_gguf(DEFAULT_MODEL_ID):
        print(f"[cybria-llm] no GGUF for {DEFAULT_MODEL_ID}; load after download")
        return
    with _load_lock:
        _loading = True
        try:
            _llama.load(DEFAULT_MODEL_ID)
            print(f"[cybria-llm] loaded {DEFAULT_MODEL_ID}")
        except Exception as exc:
            _load_error = str(exc)
            print(f"[cybria-llm] auto-load failed: {exc}")
        finally:
            _loading = False


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from cybria_log import quiet_uvicorn

    quiet_uvicorn()
    threading.Thread(target=_auto_load, daemon=True).start()
    uvicorn.run(app, host=HOST, port=PORT, log_level="info", access_log=False)
