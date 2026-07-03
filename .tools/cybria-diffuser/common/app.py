"""FastAPI app factory for Cybria diffusion servers."""

from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from typing import Literal

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from common.catalog import DEFAULT_MODEL_ID, get_model, model_catalog
from common.dispatch import generate as dispatch_generate
from common.dispatch import health as dispatch_health
from common.dispatch import list_loras as dispatch_list_loras
from common.dispatch import load_model_async
from common.env import bootstrap
from common.logging_setup import configure_library_logging
from common.schemas import GenerateBody, LoadModelBody
from common.utils import apply_cuda_runtime, log
import qwen.pipeline as qwen_backend
import sdxl.pipeline as sdxl_backend

bootstrap()
configure_library_logging()
apply_cuda_runtime()

Mode = Literal["all", "qwen", "sdxl"]


def _allowed_families(mode: Mode) -> frozenset[str]:
    if mode == "qwen":
        return frozenset({"qwen"})
    if mode == "sdxl":
        return frozenset({"sdxl", "sd15"})
    return frozenset({"qwen", "sdxl", "sd15"})


def _filter_catalog(mode: Mode):
    allowed = _allowed_families(mode)
    return [m for m in model_catalog() if m.family in allowed]


def create_app(mode: Mode = "all") -> FastAPI:
    title = {
        "all": "cybria-diffuser",
        "qwen": "cybria-diffuser-qwen",
        "sdxl": "cybria-diffuser-sdxl",
    }[mode]

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        qwen_backend.refresh_lora_catalog()
        sdxl_backend.refresh_lora_catalog()
        if os.environ.get("CYBRIA_DIFFUSER_WARMUP", os.environ.get("QWEN_IMAGE_WARMUP", "0")) == "1":
            try:
                default = _filter_catalog(mode)[0]
                if default.family == "qwen":
                    qwen_backend.load_pipeline(default.id)
                else:
                    sdxl_backend.load_pipeline(default.id)
            except Exception as exc:
                log(f"[warmup] model load failed: {exc}")
        else:
            log("[startup] idle — model loads when you click Start")
        yield

    app = FastAPI(title=title, version="0.6.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    host = os.environ.get("CYBRIA_DIFFUSER_HOST", os.environ.get("QWEN_IMAGE_HOST", "127.0.0.1"))
    port = int(os.environ.get("CYBRIA_DIFFUSER_PORT", os.environ.get("QWEN_IMAGE_PORT", "8789")))

    def _check_model_allowed(model_id: str) -> None:
        spec = get_model(model_id)
        if spec.family not in _allowed_families(mode):
            raise HTTPException(status_code=404, detail=f"Model not available on {title}")

    @app.get("/models")
    def list_models() -> dict[str, object]:
        catalog = _filter_catalog(mode)
        loaded = qwen_backend.loaded_model_id() or sdxl_backend.loaded_model_id()
        default = catalog[0].id if len(catalog) == 1 else DEFAULT_MODEL_ID
        if mode == "qwen":
            default = "qwen-lightning"
        elif mode == "sdxl":
            from sdxl.models import DEFAULT_MODEL_ID as SDXL_DEFAULT

            default = SDXL_DEFAULT
        return {
            "models": [m.to_dict() for m in catalog],
            "default": default,
            "loaded": loaded,
        }

    @app.post("/models/load")
    def load_model_endpoint(body: LoadModelBody) -> dict[str, object]:
        model_id = body.model_id.strip()
        if not model_id:
            raise HTTPException(status_code=400, detail="model_id required")
        try:
            _check_model_allowed(model_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        spec = get_model(model_id)
        mod = qwen_backend if spec.family == "qwen" else sdxl_backend
        if mod._loading:  # noqa: SLF001
            return {"ok": True, "model_id": model_id, "loading": True}
        load_model_async(model_id)
        return {"ok": True, "model_id": model_id, "loading": True}

    @app.get("/loras")
    def list_loras(model: str | None = None, refresh: bool = False) -> dict[str, object]:
        return dispatch_list_loras(model, refresh)

    @app.get("/health")
    def health() -> dict[str, object]:
        return dispatch_health(host, port)

    @app.post("/generate")
    def generate(body: GenerateBody) -> dict[str, object]:
        if not body.prompt.strip():
            raise HTTPException(status_code=400, detail="prompt is required")
        try:
            spec = get_model(
                body.model
                or qwen_backend.loaded_model_id()
                or sdxl_backend.loaded_model_id()
                or DEFAULT_MODEL_ID
            )
            _check_model_allowed(spec.id)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        try:
            return dispatch_generate(body)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=f"Model load failed: {exc}") from exc

    return app


def run(mode: Mode = "all") -> None:
    host = os.environ.get("CYBRIA_DIFFUSER_HOST", os.environ.get("QWEN_IMAGE_HOST", "127.0.0.1"))
    port = int(os.environ.get("CYBRIA_DIFFUSER_PORT", os.environ.get("QWEN_IMAGE_PORT", "8789")))
    uvicorn.run(create_app(mode), host=host, port=port, log_level="info", access_log=False)
