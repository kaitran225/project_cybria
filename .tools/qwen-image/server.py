"""Local Qwen image generation API — tuned for ~8GB VRAM + 16GB RAM."""

from __future__ import annotations

import base64
import io
import os
import random
import threading
from typing import Any

import torch
import uvicorn
from diffusers import DiffusionPipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HOST = os.environ.get("QWEN_IMAGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("QWEN_IMAGE_PORT", "8789"))
MODEL_ID = os.environ.get(
    "QWEN_IMAGE_MODEL", "unsloth/Qwen-Image-2512-unsloth-bnb-4bit"
)
MAX_SIDE = int(os.environ.get("QWEN_IMAGE_MAX_SIDE", "768"))

app = FastAPI(title="qwen-image", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipe: Any | None = None
_pipe_lock = threading.Lock()
_loading = False
_ready = False
_load_error: str | None = None


class GenerateBody(BaseModel):
    prompt: str
    width: int = 768
    height: int = 768
    steps: int = 20
    cfg: float = Field(default=4.0, alias="cfg")
    seed: str | None = None
    negativePrompt: str = ""

    model_config = {"populate_by_name": True}


def _cap_dim(value: int) -> int:
    return max(256, min(MAX_SIDE, value // 64 * 64))


def _resolve_seed(seed: str | None) -> int:
    if seed is None or seed.strip() == "":
        return random.randint(0, 2**31 - 1)
    try:
        return int(seed)
    except ValueError:
        return int.from_bytes(seed.encode("utf-8")[:4], "little") % (2**31)


def _load_pipeline() -> Any:
    global _pipe, _loading, _ready, _load_error
    with _pipe_lock:
        if _pipe is not None:
            return _pipe
        if _load_error:
            raise RuntimeError(_load_error)
        _loading = True
    try:
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        pipe = DiffusionPipeline.from_pretrained(MODEL_ID, torch_dtype=dtype)
        if torch.cuda.is_available():
            pipe.enable_model_cpu_offload()
            if hasattr(pipe, "enable_attention_slicing"):
                pipe.enable_attention_slicing()
            if hasattr(pipe, "enable_vae_slicing"):
                pipe.enable_vae_slicing()
        else:
            pipe.to("cpu")
        with _pipe_lock:
            _pipe = pipe
            _ready = True
            _loading = False
        return pipe
    except Exception as e:
        with _pipe_lock:
            _load_error = str(e)
            _loading = False
        raise


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ready": _ready,
        "loading": _loading,
        "model": MODEL_ID,
        "ready_to_generate": _ready and not _loading,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "max_side": MAX_SIDE,
        "error": _load_error,
        "config": {
            "model": MODEL_ID,
            "max_side": MAX_SIDE,
            "host": HOST,
            "port": PORT,
        },
    }


@app.post("/generate")
def generate(body: GenerateBody) -> dict[str, Any]:
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    width = _cap_dim(body.width)
    height = _cap_dim(body.height)
    steps = max(4, min(40, body.steps))
    seed = _resolve_seed(body.seed)

    try:
        pipe = _load_pipeline()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model load failed: {e}") from e

    generator = torch.Generator(device="cpu").manual_seed(seed)
    kwargs: dict[str, Any] = {
        "prompt": prompt,
        "negative_prompt": body.negativePrompt or "blurry, low quality",
        "num_inference_steps": steps,
        "generator": generator,
        "width": width,
        "height": height,
        "true_cfg_scale": body.cfg,
    }

    try:
        with _pipe_lock:
            try:
                result = pipe(**kwargs)
            except TypeError:
                kwargs.pop("true_cfg_scale", None)
                kwargs["guidance_scale"] = body.cfg
                result = pipe(**kwargs)
        image = result.images[0]
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        warnings: list[str] = []
        if width != body.width or height != body.height:
            warnings.append(f"Clamped size to {width}x{height} (max {MAX_SIDE})")
        return {
            "imageBase64": b64,
            "seed": str(seed),
            "warnings": warnings,
            "width": width,
            "height": height,
        }
    except torch.cuda.OutOfMemoryError as e:
        raise HTTPException(
            status_code=503,
            detail="GPU out of memory — try 512x512 or close other GPU apps",
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.on_event("startup")
def warmup() -> None:
    if os.environ.get("QWEN_IMAGE_WARMUP", "1") == "1":
        try:
            _load_pipeline()
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
