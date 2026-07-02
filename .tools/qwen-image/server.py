"""Local image generation API — Qwen Lightning + SDXL models, 8GB VRAM tuned."""

from __future__ import annotations

import base64
import gc
import io
import os
import random
import threading
import time
from pathlib import Path
from typing import Any

import torch
import uvicorn
from diffusers import DiffusionPipeline, StableDiffusionXLPipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from loras import LoraEntry, get_lora, resolve_lora_dir, scan_loras
from models import DEFAULT_MODEL_ID, ModelSpec, get_model, model_catalog

try:
    from diffusers import QwenImagePipeline as _QwenPipeline
except ImportError:
    _QwenPipeline = DiffusionPipeline

HOST = os.environ.get("QWEN_IMAGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("QWEN_IMAGE_PORT", "8789"))
USE_LIGHTNING = os.environ.get("QWEN_IMAGE_LIGHTNING", "1") == "1"
USE_COMPILE = os.environ.get("QWEN_IMAGE_COMPILE", "0") == "1"
LIGHTNING_REPO = os.environ.get(
    "QWEN_IMAGE_LIGHTNING_REPO", "lightx2v/Qwen-Image-2512-Lightning"
)
LIGHTNING_WEIGHT = os.environ.get(
    "QWEN_IMAGE_LIGHTNING_WEIGHT",
    "Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors",
)
LIGHTNING_FALLBACK_WEIGHT = "Qwen-Image-2512-Lightning-4steps-V1.0-bf16.safetensors"
VRAM_OFFLOAD_GB = float(os.environ.get("QWEN_IMAGE_OFFLOAD_BELOW_GB", "10"))
DEFAULT_LORA_SCALE = float(os.environ.get("QWEN_LORA_DEFAULT_SCALE", "0.85"))

LIGHTNING_ADAPTER = "lightning"
STYLE_ADAPTER = "style"

app = FastAPI(title="qwen-image", version="0.5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipe: Any | None = None
_loaded_model_id: str | None = None
_active_spec: ModelSpec | None = None
_pipe_lock = threading.Lock()
_generating = threading.Lock()
_loading = False
_ready = False
_load_error: str | None = None
_lightning_loaded = False
_lightning_weight = ""
_active_style_lora: str | None = None
_lora_catalog: list[LoraEntry] = []
_attention_backend = "sdpa"
_compiled = False
_offload_mode = "none"
_vae_tiling = False


class GenerateBody(BaseModel):
    prompt: str
    model: str | None = None
    width: int = 512
    height: int = 512
    steps: int = 8
    cfg: float = Field(default=1.0, alias="cfg")
    seed: str | None = None
    negativePrompt: str = " "
    lora: str | None = None
    loraScale: float = DEFAULT_LORA_SCALE

    model_config = {"populate_by_name": True}


def _log(msg: str) -> None:
    print(msg, flush=True)


def _apply_cuda_runtime() -> None:
    if not torch.cuda.is_available():
        return
    torch.backends.cudnn.benchmark = True
    torch.set_float32_matmul_precision("high")
    if hasattr(torch.backends.cuda, "enable_flash_sdp"):
        torch.backends.cuda.enable_flash_sdp(True)
    if hasattr(torch.backends.cuda, "enable_mem_efficient_sdp"):
        torch.backends.cuda.enable_mem_efficient_sdp(True)


_apply_cuda_runtime()


def _gpu_mem_gb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    return torch.cuda.get_device_properties(0).total_memory / (1024**3)


def _cap_dim(value: int, max_side: int) -> int:
    return max(256, min(max_side, value // 64 * 64))


def _resolve_seed(seed: str | None) -> int:
    if seed is None or seed.strip() == "":
        return random.randint(0, 2**31 - 1)
    try:
        return int(seed)
    except ValueError:
        return int.from_bytes(seed.encode("utf-8")[:4], "little") % (2**31)


def _clear_cuda() -> None:
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


def _refresh_lora_catalog() -> list[LoraEntry]:
    global _lora_catalog
    _lora_catalog = scan_loras(resolve_lora_dir())
    return _lora_catalog


def _unload_pipeline() -> None:
    global _pipe, _ready, _loaded_model_id, _active_spec
    global _lightning_loaded, _lightning_weight, _active_style_lora, _compiled, _load_error
    with _pipe_lock:
        if _pipe is not None:
            del _pipe
        _pipe = None
        _ready = False
        _loaded_model_id = None
        _active_spec = None
        _lightning_loaded = False
        _lightning_weight = ""
        _active_style_lora = None
        _compiled = False
        _load_error = None
    _clear_cuda()


def _place_pipe(pipe: Any, spec: ModelSpec) -> None:
    global _pipe, _ready, _loaded_model_id, _active_spec, _loading
    with _pipe_lock:
        _pipe = pipe
        _loaded_model_id = spec.id
        _active_spec = spec
        _ready = True
        _loading = False


def _apply_memory_opts(pipe: Any) -> None:
    global _vae_tiling
    vae = getattr(pipe, "vae", None)
    if vae is not None and hasattr(vae, "enable_tiling"):
        vae.enable_tiling()
        _vae_tiling = True
        _log("[load] VAE tiling enabled")


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
            _log("[load] attention: flash_attention_2")
            return _attention_backend
    except ImportError:
        pass
    except Exception as exc:
        _log(f"[load] flash_attention_2 skipped: {exc}")
    _attention_backend = "sdpa"
    _log("[load] attention: sdpa")
    return _attention_backend


def _maybe_compile(pipe: Any) -> bool:
    global _compiled
    if not USE_COMPILE or not torch.cuda.is_available():
        return False
    transformer = getattr(pipe, "transformer", None)
    if transformer is None:
        return False
    try:
        pipe.transformer = torch.compile(transformer, mode="reduce-overhead")
        _compiled = True
        _log("[load] torch.compile enabled")
        return True
    except Exception as exc:
        _log(f"[load] torch.compile skipped: {exc}")
        return False


def _purge_style_lora(pipe: Any) -> None:
    global _active_style_lora
    if _active_style_lora is None:
        return
    try:
        if hasattr(pipe, "delete_adapters"):
            pipe.delete_adapters(STYLE_ADAPTER)
        elif hasattr(pipe, "unload_lora_weights"):
            pipe.unload_lora_weights()
    except Exception as exc:
        _log(f"[lora] purge style failed: {exc}")
    _active_style_lora = None


def _load_lightning(pipe: Any) -> bool:
    global _lightning_loaded, _lightning_weight
    if not USE_LIGHTNING:
        return False
    weights = [LIGHTNING_WEIGHT]
    if LIGHTNING_WEIGHT != LIGHTNING_FALLBACK_WEIGHT:
        weights.append(LIGHTNING_FALLBACK_WEIGHT)
    for weight in weights:
        try:
            pipe.load_lora_weights(
                LIGHTNING_REPO,
                weight_name=weight,
                adapter_name=LIGHTNING_ADAPTER,
            )
            pipe.set_adapters([LIGHTNING_ADAPTER], adapter_weights=[1.0])
            _lightning_loaded = True
            _lightning_weight = weight
            _log(f"[load] lightning LoRA: {weight}")
            return True
        except Exception as exc:
            _log(f"[load] lightning LoRA failed ({weight}): {exc}")
    _lightning_loaded = False
    return False


def _ensure_style_lora(pipe: Any, entry: LoraEntry) -> None:
    global _active_style_lora
    if _active_style_lora == entry.id:
        return
    _purge_style_lora(pipe)
    lora_path = Path(entry.path)
    pipe.load_lora_weights(
        str(lora_path.parent),
        weight_name=lora_path.name,
        adapter_name=STYLE_ADAPTER,
    )
    _active_style_lora = entry.id
    _log(f"[lora] loaded style: {entry.filename}")


def _configure_adapters(
    pipe: Any, spec: ModelSpec, lora_id: str | None, lora_scale: float
) -> list[str]:
    warnings: list[str] = []
    adapters: list[str] = []
    weights: list[float] = []

    if spec.family == "qwen" and _lightning_loaded:
        adapters.append(LIGHTNING_ADAPTER)
        weights.append(1.0)

    if lora_id:
        entry = get_lora(lora_id, resolve_lora_dir())
        if entry is None:
            warnings.append(f"LoRA '{lora_id}' not found")
        else:
            ok, reason = entry.compat_reason(spec.family)
            if not ok:
                warnings.append(f"LoRA '{entry.name}' skipped: {reason}")
            else:
                _ensure_style_lora(pipe, entry)
                adapters.append(STYLE_ADAPTER)
                weights.append(max(0.0, min(2.0, lora_scale)))
    elif _active_style_lora is not None:
        _purge_style_lora(pipe)

    if adapters and hasattr(pipe, "set_adapters"):
        pipe.set_adapters(adapters, adapter_weights=weights)
    return warnings


def _load_qwen(spec: ModelSpec) -> Any:
    global _offload_mode, _active_style_lora
    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    loader = _QwenPipeline if _QwenPipeline is not DiffusionPipeline else DiffusionPipeline
    vram = _gpu_mem_gb()
    _log(f"[load] qwen {spec.repo_id} cuda={torch.cuda.is_available()} vram={vram:.1f}GB")
    pipe = loader.from_pretrained(spec.repo_id, torch_dtype=dtype)

    if torch.cuda.is_available():
        if vram <= VRAM_OFFLOAD_GB:
            pipe.enable_model_cpu_offload()
            _offload_mode = "cpu_offload"
            _log("[load] model CPU offload (low VRAM)")
        else:
            try:
                pipe.to("cuda")
                _offload_mode = "full_gpu"
                _log("[load] full GPU")
            except torch.cuda.OutOfMemoryError:
                _clear_cuda()
                pipe.enable_model_cpu_offload()
                _offload_mode = "cpu_offload"
                _log("[load] model CPU offload (OOM)")
        _apply_memory_opts(pipe)
        _apply_attention_backend(pipe)
    else:
        pipe.to("cpu")
        _offload_mode = "cpu"

    _active_style_lora = None
    _load_lightning(pipe)
    _maybe_compile(pipe)
    return pipe


def _load_sdxl(spec: ModelSpec) -> Any:
    global _offload_mode, _active_style_lora, _lightning_loaded
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    _log(f"[load] sdxl {spec.repo_id} cuda={torch.cuda.is_available()}")
    pipe = StableDiffusionXLPipeline.from_pretrained(
        spec.repo_id,
        torch_dtype=dtype,
        use_safetensors=True,
    )
    if torch.cuda.is_available():
        pipe.enable_model_cpu_offload()
        _offload_mode = "cpu_offload"
        _log("[load] SDXL CPU offload")
    else:
        pipe.to("cpu")
        _offload_mode = "cpu"
    _apply_memory_opts(pipe)
    _active_style_lora = None
    _lightning_loaded = False
    return pipe


def _load_pipeline(model_id: str | None = None) -> Any:
    global _loading, _load_error
    spec = get_model(model_id or _loaded_model_id or DEFAULT_MODEL_ID)

    with _pipe_lock:
        if _pipe is not None and _loaded_model_id == spec.id:
            return _pipe
        if _load_error and _loaded_model_id == spec.id:
            raise RuntimeError(_load_error)

    if _pipe is not None:
        _log(f"[load] switching model → {spec.id}")
        _unload_pipeline()

    with _pipe_lock:
        _loading = True
        _load_error = None

    try:
        t0 = time.time()
        if spec.family == "qwen":
            pipe = _load_qwen(spec)
        elif spec.family == "sdxl":
            pipe = _load_sdxl(spec)
        else:
            raise RuntimeError(f"Unsupported model family: {spec.family}")

        _refresh_lora_catalog()
        _clear_cuda()
        _log(f"[load] {spec.id} ready in {time.time() - t0:.1f}s offload={_offload_mode}")
        _place_pipe(pipe, spec)
        return pipe
    except Exception as e:
        with _pipe_lock:
            _load_error = str(e)
            _loading = False
        raise


def _run_inference(pipe: Any, spec: ModelSpec, kwargs: dict[str, Any]) -> Any:
    if spec.family == "sdxl":
        kwargs = dict(kwargs)
        cfg = kwargs.pop("true_cfg_scale", kwargs.get("guidance_scale", 7.5))
        kwargs["guidance_scale"] = cfg
        return pipe(**kwargs)
    try:
        return pipe(**kwargs)
    except TypeError:
        kwargs = dict(kwargs)
        kwargs.pop("true_cfg_scale", None)
        kwargs["guidance_scale"] = kwargs.get("guidance_scale", 1.0)
        return pipe(**kwargs)


def _oom_fallback_sizes(
    width: int, height: int, max_side: int
) -> list[tuple[int, int]]:
    sizes: list[tuple[int, int]] = [(width, height)]
    fallback = min(512, max_side)
    if width > fallback or height > fallback:
        scale = fallback / max(width, height)
        w = max(256, int(width * scale) // 64 * 64)
        h = max(256, int(height * scale) // 64 * 64)
        sizes.append((_cap_dim(w, max_side), _cap_dim(h, max_side)))
    return sizes


@app.get("/models")
def list_models() -> dict[str, Any]:
    loaded = _loaded_model_id
    return {
        "models": [m.to_dict() for m in model_catalog()],
        "default": DEFAULT_MODEL_ID,
        "loaded": loaded,
    }


@app.get("/loras")
def list_loras(model: str | None = None, refresh: bool = False) -> dict[str, Any]:
    entries = _refresh_lora_catalog() if refresh else (_lora_catalog or _refresh_lora_catalog())
    lora_dir = resolve_lora_dir()
    try:
        spec = get_model(model or _loaded_model_id or DEFAULT_MODEL_ID)
        family = spec.family
    except KeyError:
        family = "qwen"
    loras = [e.to_dict(family) for e in entries]
    return {
        "directory": str(lora_dir),
        "exists": lora_dir.is_dir(),
        "model_family": family,
        "loras": loras,
        "compatible_count": sum(1 for e in loras if e.get("compatible")),
    }


@app.get("/health")
def health() -> dict[str, Any]:
    spec = _active_spec or get_model(DEFAULT_MODEL_ID)
    return {
        "ready": _ready,
        "loading": _loading,
        "model": spec.repo_id,
        "model_id": spec.id,
        "model_name": spec.name,
        "model_family": spec.family,
        "ready_to_generate": _ready and not _loading,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "max_side": spec.max_side,
        "vram_gb": round(_gpu_mem_gb(), 1),
        "error": _load_error,
        "lightning": _lightning_loaded,
        "active_style_lora": _active_style_lora,
        "lora_directory": str(resolve_lora_dir()),
        "optimizations": {
            "offload": _offload_mode,
            "compile": _compiled,
            "attention": _attention_backend,
            "vae_tiling": _vae_tiling,
            "lightning_weight": _lightning_weight or None,
        },
        "config": {
            "model": spec.repo_id,
            "model_id": spec.id,
            "max_side": spec.max_side,
            "host": HOST,
            "port": PORT,
            "lightning": _lightning_loaded,
            "recommended_steps": spec.default_steps,
            "recommended_cfg": spec.default_cfg,
            "recommended_size": spec.default_size,
        },
    }


@app.post("/generate")
def generate(body: GenerateBody) -> dict[str, Any]:
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    try:
        spec = get_model(body.model or _loaded_model_id or DEFAULT_MODEL_ID)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    width = _cap_dim(body.width, spec.max_side)
    height = _cap_dim(body.height, spec.max_side)
    steps = max(1, min(40, body.steps))
    seed = _resolve_seed(body.seed)
    neg = body.negativePrompt if body.negativePrompt.strip() else " "
    lora_id = body.lora.strip() if body.lora and body.lora.strip() else None

    try:
        pipe = _load_pipeline(spec.id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model load failed: {e}") from e

    generator = torch.Generator(device="cpu").manual_seed(seed)
    sizes = _oom_fallback_sizes(width, height, spec.max_side)

    _log(
        f"[generate] model={spec.id} {width}x{height} steps={steps} cfg={body.cfg} "
        f"lora={lora_id or 'none'}"
    )
    t0 = time.time()
    warnings: list[str] = []
    last_oom: Exception | None = None
    result: Any = None

    with _generating:
        warnings.extend(_configure_adapters(pipe, spec, lora_id, body.loraScale))

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
                _log(f"[generate] retry at {w}x{h} after OOM")
                warnings.append(f"OOM at {width}×{height} — retried at {w}×{h}")
            _clear_cuda()
            try:
                result = _run_inference(pipe, spec, kwargs)
                width, height = w, h
                break
            except torch.cuda.OutOfMemoryError as e:
                last_oom = e
                _clear_cuda()
                if attempt + 1 >= len(sizes):
                    raise HTTPException(
                        status_code=503,
                        detail="GPU OOM — lower resolution and restart server",
                    ) from e
            except Exception as e:
                _log(f"[generate] failed after {time.time() - t0:.1f}s: {e}")
                raise HTTPException(status_code=500, detail=str(e)) from e
        else:
            raise HTTPException(status_code=503, detail="GPU OOM") from last_oom

    elapsed = time.time() - t0
    _log(f"[generate] done in {elapsed:.1f}s")
    image = result.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    if width != body.width or height != body.height:
        warnings.append(f"Clamped size to {width}×{height} (max {spec.max_side})")
    if spec.lightning and steps > 8:
        warnings.append("Lightning works best with 4–8 steps")
    if spec.lightning and body.cfg > 2:
        warnings.append("Lightning works best with CFG ~1.0")
    _clear_cuda()
    return {
        "imageBase64": b64,
        "seed": str(seed),
        "warnings": warnings,
        "width": width,
        "height": height,
        "elapsedSec": round(elapsed, 1),
        "lora": lora_id,
        "model": spec.id,
    }


@app.on_event("startup")
def warmup() -> None:
    _refresh_lora_catalog()
    if os.environ.get("QWEN_IMAGE_WARMUP", "1") == "1":
        try:
            _load_pipeline(DEFAULT_MODEL_ID)
        except Exception as exc:
            _log(f"[warmup] model load failed: {exc}")


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
