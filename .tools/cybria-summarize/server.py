"""Cybria summarization API — PEGASUS / BART via transformers."""

from __future__ import annotations

import os
import threading
from typing import Any

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from model_paths import ensure_model_dirs, summarization_dir
from models import DEFAULT_MODEL_ID, get_model, model_catalog, model_local_dir

ensure_model_dirs()

HOST = os.environ.get("CYBRIA_SUMMARIZE_HOST", "127.0.0.1")
PORT = int(os.environ.get("CYBRIA_SUMMARIZE_PORT", "8791"))

app = FastAPI(title="cybria-summarize", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache: dict[str, tuple[Any, Any]] = {}
_lock = threading.Lock()
_active_model = DEFAULT_MODEL_ID
_load_error: str | None = None


class SummarizeRequest(BaseModel):
    text: str
    model_id: str = Field(default=DEFAULT_MODEL_ID)
    max_length: int | None = None
    min_length: int | None = None


class LoadRequest(BaseModel):
    model_id: str = Field(default=DEFAULT_MODEL_ID)


def _device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load_pipeline(model_id: str) -> tuple[Any, Any]:
    with _lock:
        if model_id in _cache:
            return _cache[model_id]
        spec = get_model(model_id)
        local = model_local_dir(model_id)
        source = str(local) if local.is_dir() and any(local.iterdir()) else spec.repo_id
        print(f"[summarize] loading {model_id} from {source}")
        tok = AutoTokenizer.from_pretrained(source)
        model = AutoModelForSeq2SeqLM.from_pretrained(source)
        model.to(_device())
        model.eval()
        _cache[model_id] = (tok, model)
        return tok, model


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ready": True,
        "model_id": _active_model,
        "device": _device(),
        "error": _load_error,
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    return {"default": DEFAULT_MODEL_ID, "models": model_catalog()}


@app.post("/models/load")
def load_model(req: LoadRequest) -> dict[str, Any]:
    global _active_model, _load_error
    try:
        _load_pipeline(req.model_id)
        _active_model = req.model_id
        _load_error = None
        return {"ok": True, "model_id": req.model_id}
    except Exception as exc:
        _load_error = str(exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/summarize")
def summarize(req: SummarizeRequest) -> dict[str, Any]:
    global _active_model, _load_error
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    spec = get_model(req.model_id)
    if len(text) > spec.max_input_chars:
        text = text[: spec.max_input_chars]

    try:
        tok, model = _load_pipeline(req.model_id)
        _active_model = req.model_id
        inputs = tok(text, return_tensors="pt", truncation=True, max_length=1024)
        inputs = {k: v.to(_device()) for k, v in inputs.items()}
        max_len = req.max_length or spec.default_max_length
        min_len = req.min_length or spec.default_min_length
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_length=max_len,
                min_length=min(min_len, max_len - 1),
                num_beams=4,
                early_stopping=True,
            )
        summary = tok.decode(out[0], skip_special_tokens=True)
        _load_error = None
        return {"summary": summary, "model_id": req.model_id}
    except Exception as exc:
        _load_error = str(exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/download")
def download_model_endpoint(req: LoadRequest) -> dict[str, Any]:
    from huggingface_hub import snapshot_download

    spec = get_model(req.model_id)
    dest = model_local_dir(req.model_id)
    dest.mkdir(parents=True, exist_ok=True)
    try:
        path = snapshot_download(
            repo_id=spec.repo_id,
            local_dir=str(dest),
        )
        return {"ok": True, "path": path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    os.environ.setdefault("HF_HOME", str(summarization_dir().parent))
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
