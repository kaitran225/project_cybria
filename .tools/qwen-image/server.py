"""Local Qwen image generation API — tuned for ~8GB VRAM + 16GB RAM."""

from __future__ import annotations

import base64
import gc
import io
import os
import random
import threading
import time
from typing import Any

import torch
import uvicorn
from diffusers import DiffusionPipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from diffusers import QwenImagePipeline as _QwenPipeline
except ImportError:
    _QwenPipeline = DiffusionPipeline

HOST = os.environ.get("QWEN_IMAGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("QWEN_IMAGE_PORT", "8789"))
MODEL_ID = os.environ.get(
    "QWEN_IMAGE_MODEL", "unsloth/Qwen-Image-2512-unsloth-bnb-4bit"
)
MAX_SIDE = int(os.environ.get("QWEN_IMAGE_MAX_SIDE", "1024"))
USE_LIGHTNING = os.environ.get("QWEN_IMAGE_LIGHTNING", "1") == "1"
USE_COMPILE = os.environ.get("QWEN_IMAGE_COMPILE", "1") == "1"
LIGHTNING_REPO = os.environ.get(
    "QWEN_IMAGE_LIGHTNING_REPO", "lightx2v/Qwen-Image-2512-Lightning"
)
LIGHTNING_WEIGHT = os.environ.get(
    "QWEN_IMAGE_LIGHTNING_WEIGHT",
    "Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors",
)
LIGHTNING_FALLBACK_WEIGHT = "Qwen-Image-2512-Lightning-4steps-V1.0-bf16.safetensors"
VRAM_OFFLOAD_GB = float(os.environ.get("QWEN_IMAGE_OFFLOAD_BELOW_GB", "10"))

app = FastAPI(title="qwen-image", version="0.3.0")
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
_lightning_loaded = False
_lightning_weight = ""
_attention_backend = "sdpa"
_compiled = False
_offload_mode = "none"
_vae_tiling = False


class GenerateBody(BaseModel):
    prompt: str
    width: int = 768
    height: int = 768
    steps: int = 8
    cfg: float = Field(default=1.0, alias="cfg")
    seed: str | None = None
    negativePrompt: str = " "

    model_config = {"populate_by_name": True}


def _apply_cuda_runtime() -> None:
    if not torch.cuda.is_available():
        return
    torch.backends.cudnn.benchmark = True
    torch.set_float32_matmul_precision("high")
    if hasattr(torch.backends.cuda, "enable_flash_sdp"):
        torch.backends.cuda.enable_flash_sdp(True)
    if hasattr(torch.backends.cuda, "enable_mem_efficient_sdp"):
        torch.backends.cuda.enable_mem_efficient_sdp(True)
    if hasattr(torch.backends.cuda, "enable_math_sdp"):
        torch.backends.cuda.enable_math_sdp(True)


_apply_cuda_runtime()


def _gpu_mem_gb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    return torch.cuda.get_device_properties(0).total_memory / (1024**3)


def _cap_dim(value: int) -> int:
    return max(256, min(MAX_SIDE, value // 64 * 64))


def _resolve_seed(seed: str | None) -> int:
    if seed is None or seed.strip() == "":
        return random.randint(0, 2**31 - 1)
    try:
        return int(seed)
    except ValueError:
        return int.from_bytes(seed.encode("utf-8")[:4], "little") % (2**31)


def _apply_memory_layout(pipe: Any) -> None:
    for name in ("transformer", "vae"):
        mod = getattr(pipe, name, None)
        if mod is None:
            continue
        try:
            mod.to(memory_format=torch.channels_last)
        except Exception as exc:
            print(f"[load] channels_last skipped for {name}: {exc}")


def _apply_memory_opts(pipe: Any) -> None:
    global _vae_tiling
    vae = getattr(pipe, "vae", None)
    if vae is not None and hasattr(vae, "enable_tiling"):
        vae.enable_tiling()
        _vae_tiling = True
        print("[load] VAE tiling enabled")


def _apply_attention_backend(pipe: Any) -> str:
    global _attention_backend
    transformer = getattr(pipe, "transformer", None)
    if transformer is None:
        return _attention_backend

    try:
        import flash_attn  # noqa: F401

        if hasattr(transformer, "set_attn_implementation"):
            transformer.set_attn_implementation("flash_attention_2")
            _attention_backend = "flash_attention_2"
            print("[load] attention: flash_attention_2")
            return _attention_backend
    except ImportError:
        pass
    except Exception as exc:
        print(f"[load] flash_attention_2 skipped: {exc}")

    _attention_backend = "sdpa"
    print("[load] attention: pytorch sdpa")
    return _attention_backend


def _maybe_compile(pipe: Any) -> bool:
    global _compiled
    if not USE_COMPILE or not torch.cuda.is_available():
        return False
    transformer = getattr(pipe, "transformer", None)
    if transformer is None:
        return False
    try:
        pipe.transformer = torch.compile(transformer, mode="max-autotune")
        _compiled = True
        print("[load] torch.compile(max-autotune) — first generate will be slow")
        return True
    except Exception as exc:
        print(f"[load] torch.compile skipped: {exc}")
        return False


def _load_lightning(pipe: Any) -> bool:
    global _lightning_loaded, _lightning_weight
    if not USE_LIGHTNING:
        return False
    weights = [LIGHTNING_WEIGHT]
    if LIGHTNING_WEIGHT != LIGHTNING_FALLBACK_WEIGHT:
        weights.append(LIGHTNING_FALLBACK_WEIGHT)
    for weight in weights:
        try:
            pipe.load_lora_weights(LIGHTNING_REPO, weight_name=weight)
            _lightning_loaded = True
            _lightning_weight = weight
            print(f"[load] lightning LoRA: {weight}")
            return True
        except Exception as exc:
            print(f"[load] lightning LoRA failed ({weight}): {exc}")
    _lightning_loaded = False
    return False


def _clear_cuda() -> None:
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


def _load_pipeline() -> Any:
    global _pipe, _loading, _ready, _load_error, _offload_mode
    with _pipe_lock:
        if _pipe is not None:
            return _pipe
        if _load_error:
            raise RuntimeError(_load_error)
        _loading = True
    try:
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        loader = _QwenPipeline if _QwenPipeline is not DiffusionPipeline else DiffusionPipeline
        vram = _gpu_mem_gb()
        print(f"[load] {MODEL_ID} cuda={torch.cuda.is_available()} vram={vram:.1f}GB")
        t0 = time.time()
        pipe = loader.from_pretrained(MODEL_ID, torch_dtype=dtype)

        if torch.cuda.is_available():
            if vram <= VRAM_OFFLOAD_GB:
                pipe.enable_model_cpu_offload()
                _offload_mode = "cpu_offload"
                print("[load] model CPU offload (low VRAM)")
            else:
                try:
                    pipe.to("cuda")
                    _offload_mode = "full_gpu"
                    print("[load] full GPU")
                except torch.cuda.OutOfMemoryError:
                    _clear_cuda()
                    pipe.enable_model_cpu_offload()
                    _offload_mode = "cpu_offload"
                    print("[load] model CPU offload (OOM on full GPU)")
            _apply_memory_layout(pipe)
            _apply_memory_opts(pipe)
            _apply_attention_backend(pipe)
        else:
            pipe.to("cpu")
            _offload_mode = "cpu"

        _load_lightning(pipe)
        _maybe_compile(pipe)

        _clear_cuda()
        print(
            f"[load] ready in {time.time() - t0:.1f}s max_side={MAX_SIDE} "
            f"offload={_offload_mode} compile={_compiled} attn={_attention_backend}"
        )
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


def _run_inference(pipe: Any, kwargs: dict[str, Any]) -> Any:
    try:
        return pipe(**kwargs)
    except TypeError:
        kwargs = dict(kwargs)
        kwargs.pop("true_cfg_scale", None)
        kwargs["guidance_scale"] = kwargs.get("guidance_scale", 1.0)
        return pipe(**kwargs)


def _oom_fallback_sizes(width: int, height: int) -> list[tuple[int, int]]:
    sizes: list[tuple[int, int]] = [(width, height)]
    if width > 512 or height > 512:
        sizes.append((min(width, 512), min(height, 512)))
    return sizes


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ready": _ready,
        "loading": _loading,
        "model": MODEL_ID,
        "ready_to_generate": _ready and not _loading,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "max_side": MAX_SIDE,
        "vram_gb": round(_gpu_mem_gb(), 1),
        "error": _load_error,
        "lightning": _lightning_loaded,
        "optimizations": {
            "offload": _offload_mode,
            "compile": _compiled,
            "attention": _attention_backend,
            "vae_tiling": _vae_tiling,
            "lightning_weight": _lightning_weight or None,
        },
        "config": {
            "model": MODEL_ID,
            "max_side": MAX_SIDE,
            "host": HOST,
            "port": PORT,
            "lightning": USE_LIGHTNING and _lightning_loaded,
            "recommended_steps": 8 if _lightning_loaded else 24,
            "recommended_cfg": 1.0 if _lightning_loaded else 4.0,
            "recommended_size": 768,
        },
    }


@app.post("/generate")
def generate(body: GenerateBody) -> dict[str, Any]:
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    width = _cap_dim(body.width)
    height = _cap_dim(body.height)
    steps = max(1, min(40, body.steps))
    seed = _resolve_seed(body.seed)
    neg = body.negativePrompt if body.negativePrompt.strip() else " "

    try:
        pipe = _load_pipeline()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model load failed: {e}") from e

    generator = torch.Generator(device="cpu").manual_seed(seed)
    sizes = _oom_fallback_sizes(width, height)

    print(
        f"[generate] start {width}x{height} steps={steps} cfg={body.cfg} "
        f"lightning={_lightning_loaded}"
    )
    t0 = time.time()
    warnings: list[str] = []
    last_oom: Exception | None = None
    result: Any = None

    for attempt, (w, h) in enumerate(sizes):
        kwargs: dict[str, Any] = {
            "prompt": prompt,
            "negative_prompt": neg,
            "num_inference_steps": steps,
            "generator": generator,
            "width": w,
            "height": h,
            "true_cfg_scale": body.cfg,
        }
        if attempt > 0:
            print(f"[generate] retry at {w}x{h} after OOM")
            warnings.append(f"OOM at {width}x{height} — retried at {w}x{h}")
        _clear_cuda()
        try:
            result = _run_inference(pipe, kwargs)
            width, height = w, h
            break
        except torch.cuda.OutOfMemoryError as e:
            last_oom = e
            _clear_cuda()
            if attempt + 1 >= len(sizes):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "GPU out of memory — use 512×512, close other GPU apps, "
                        "then restart the server"
                    ),
                ) from e
        except Exception as e:
            print(f"[generate] failed after {time.time() - t0:.1f}s: {e}")
            raise HTTPException(status_code=500, detail=str(e)) from e
    else:
        raise HTTPException(
            status_code=503,
            detail="GPU out of memory — restart server and use 512×512",
        ) from last_oom

    try:
        elapsed = time.time() - t0
        print(f"[generate] done in {elapsed:.1f}s ({elapsed / max(steps, 1):.1f}s/step)")
        image = result.images[0]
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        if width != body.width or height != body.height:
            warnings.append(f"Clamped size to {width}x{height} (max {MAX_SIDE})")
        if _lightning_loaded and steps > 8:
            warnings.append("Lightning LoRA works best with 4–8 steps")
        if _lightning_loaded and body.cfg > 2:
            warnings.append("Lightning LoRA works best with CFG ~1.0")
        _clear_cuda()
        return {
            "imageBase64": b64,
            "seed": str(seed),
            "warnings": warnings,
            "width": width,
            "height": height,
            "elapsedSec": round(elapsed, 1),
        }
    except torch.cuda.OutOfMemoryError as e:
        _clear_cuda()
        raise HTTPException(
            status_code=503,
            detail="GPU OOM during save — use 512×512 and restart server",
        ) from e


@app.on_event("startup")
def warmup() -> None:
    if os.environ.get("QWEN_IMAGE_WARMUP", "1") == "1":
        try:
            _load_pipeline()
        except Exception as exc:
            print(f"[warmup] model load failed: {exc}")


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
