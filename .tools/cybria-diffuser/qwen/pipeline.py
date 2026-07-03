"""Qwen Image pipeline load, LoRA, and generation."""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path
from typing import Any

import torch
from diffusers import DiffusionPipeline

from common.loras import LoraEntry, get_lora, resolve_lora_dir, scan_loras
from common.schemas import GenerateBody
from common.utils import (
    apply_memory_opts,
    cap_dim,
    clear_cuda,
    gpu_mem_gb,
    load_logged,
    log,
    make_progress_callback,
    oom_fallback_sizes,
    resolve_seed,
    run_inference,
    run_with_heartbeat,
)
from qwen.models import ModelSpec, model_catalog

try:
    from diffusers import QwenImagePipeline as _QwenPipeline
except ImportError:
    _QwenPipeline = DiffusionPipeline

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
LIGHTNING_ADAPTER = "lightning"
STYLE_ADAPTER = "style"

_pipe: Any | None = None
_loaded_model_id: str | None = None
_active_spec: ModelSpec | None = None
_pipe_lock = threading.Lock()
_generating = threading.Lock()
_loading = False
_ready = False
_load_error: str | None = None
_pending_model_id: str | None = None
_lightning_loaded = False
_lightning_weight = ""
_active_style_lora: str | None = None
_attention_backend = "sdpa"
_compiled = False
_offload_mode = "none"
_vae_tiling = False
_lora_catalog: list[LoraEntry] = []


def refresh_lora_catalog() -> list[LoraEntry]:
    global _lora_catalog
    _lora_catalog = scan_loras(resolve_lora_dir())
    return _lora_catalog


def unload() -> None:
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
    clear_cuda()


def _place_pipe(pipe: Any, spec: ModelSpec) -> None:
    global _pipe, _ready, _loaded_model_id, _active_spec, _loading, _pending_model_id
    with _pipe_lock:
        _pipe = pipe
        _loaded_model_id = spec.id
        _active_spec = spec
        _ready = True
        _loading = False
        _pending_model_id = None


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
            log("[load] attention: flash_attention_2")
            return _attention_backend
    except ImportError:
        pass
    except Exception as exc:
        log(f"[load] flash_attention_2 skipped: {exc}")
    _attention_backend = "sdpa"
    log("[load] attention: sdpa")
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
        log("[load] torch.compile enabled")
        return True
    except Exception as exc:
        log(f"[load] torch.compile skipped: {exc}")
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
        log(f"[lora] purge style failed: {exc}")
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
            log(f"[load] lightning LoRA: {weight}")
            return True
        except Exception as exc:
            log(f"[load] lightning LoRA failed ({weight}): {exc}")
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
    log(f"[lora] loaded style: {entry.filename}")


def configure_adapters(
    pipe: Any, spec: ModelSpec, lora_id: str | None, lora_scale: float
) -> list[str]:
    warnings: list[str] = []
    adapters: list[str] = []
    weights: list[float] = []

    if _lightning_loaded:
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
    global _offload_mode, _active_style_lora, _vae_tiling
    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    vram = gpu_mem_gb()
    log(f"[load] qwen {spec.repo_id} cuda={torch.cuda.is_available()} vram={vram:.1f}GB")

    def _build() -> Any:
        log(f"[load] fetching qwen components for {spec.id}…")
        loader = _QwenPipeline if _QwenPipeline is not DiffusionPipeline else DiffusionPipeline
        return loader.from_pretrained(spec.repo_id, torch_dtype=dtype)

    pipe = run_with_heartbeat(f"loading {spec.id}", _build)
    log(f"[load] weights ready for {spec.id}")

    if torch.cuda.is_available():
        if vram <= VRAM_OFFLOAD_GB:
            pipe.enable_model_cpu_offload()
            _offload_mode = "cpu_offload"
            log("[load] model CPU offload (low VRAM)")
        else:
            try:
                pipe.to("cuda")
                _offload_mode = "full_gpu"
                log("[load] full GPU")
            except torch.cuda.OutOfMemoryError:
                clear_cuda()
                pipe.enable_model_cpu_offload()
                _offload_mode = "cpu_offload"
                log("[load] model CPU offload (OOM)")
        _vae_tiling = apply_memory_opts(pipe)
        _apply_attention_backend(pipe)
    else:
        pipe.to("cpu")
        _offload_mode = "cpu"

    _active_style_lora = None
    _load_lightning(pipe)
    _maybe_compile(pipe)
    return pipe


def load_pipeline(model_id: str | None = None) -> Any:
    global _loading, _load_error, _pending_model_id
    mid = model_id or _loaded_model_id or "qwen-lightning"
    spec = next(m for m in model_catalog() if m.id == mid)
    _pending_model_id = spec.id

    with _pipe_lock:
        if _pipe is not None and _loaded_model_id == spec.id:
            return _pipe
        if _load_error and _loaded_model_id == spec.id:
            raise RuntimeError(_load_error)

    if _pipe is not None:
        log(f"[load] switching model → {spec.id}")
        unload()
    else:
        log(f"[load] loading {spec.id} (qwen)…")

    with _pipe_lock:
        _loading = True
        _load_error = None

    try:
        t0 = time.time()
        pipe = _load_qwen(spec)
        refresh_lora_catalog()
        clear_cuda()
        log(f"[load] {spec.id} ready in {time.time() - t0:.1f}s offload={_offload_mode}")
        _place_pipe(pipe, spec)
        return pipe
    except Exception as exc:
        with _pipe_lock:
            _load_error = str(exc)
            _loading = False
            _pending_model_id = None
        raise


def generate(body: GenerateBody, spec: ModelSpec) -> dict[str, Any]:
    import base64
    import io

    from fastapi import HTTPException

    prompt = body.prompt.strip()
    width = cap_dim(body.width, spec.max_side)
    height = cap_dim(body.height, spec.max_side)
    steps = max(1, min(40, body.steps))
    seed = resolve_seed(body.seed)
    neg = body.negativePrompt if body.negativePrompt.strip() else " "
    lora_id = body.lora.strip() if body.lora and body.lora.strip() else None

    try:
        pipe = load_pipeline(spec.id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model load failed: {exc}") from exc

    generator = torch.Generator(device="cpu").manual_seed(seed)
    sizes = oom_fallback_sizes(width, height, spec.max_side)

    log(
        f"[generate] model={spec.id} {width}x{height} steps={steps} cfg={body.cfg} "
        f"lora={lora_id or 'none'}"
    )
    t0 = time.time()
    warnings: list[str] = []
    last_oom: Exception | None = None
    result: Any = None

    with _generating:
        warnings.extend(configure_adapters(pipe, spec, lora_id, body.loraScale))

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
                log(f"[generate] retry at {w}x{h} after OOM")
                warnings.append(f"OOM at {width}×{height} — retried at {w}×{h}")
            clear_cuda()
            try:
                log(f"[generate] sampling {steps} steps at {w}x{h}…")
                progress = make_progress_callback(steps, f"{w}x{h}")
                result = run_inference(pipe, spec.family, kwargs, progress)
                width, height = w, h
                break
            except torch.cuda.OutOfMemoryError as exc:
                last_oom = exc
                clear_cuda()
                if attempt + 1 >= len(sizes):
                    raise HTTPException(
                        status_code=503,
                        detail="GPU OOM — lower resolution and restart server",
                    ) from exc
            except Exception as exc:
                log(f"[generate] failed after {time.time() - t0:.1f}s: {exc}")
                raise HTTPException(status_code=500, detail=str(exc)) from exc
        else:
            raise HTTPException(status_code=503, detail="GPU OOM") from last_oom

    elapsed = time.time() - t0
    log(f"[generate] done in {elapsed:.1f}s")
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
    clear_cuda()
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


def health(host: str, port: int, fallback_model_id: str) -> dict[str, Any]:
    from common.catalog import get_model

    if _loading and _pending_model_id:
        spec = get_model(_pending_model_id)
    elif _active_spec is not None:
        spec = _active_spec
    else:
        spec = get_model(_loaded_model_id or fallback_model_id)
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
        "vram_gb": round(gpu_mem_gb(), 1),
        "error": _load_error,
        "lightning": _lightning_loaded,
        "active_style_lora": _active_style_lora,
        "lora_directory": str(resolve_lora_dir()),
        "backend": "qwen",
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
            "host": host,
            "port": port,
            "lightning": _lightning_loaded,
            "recommended_steps": spec.default_steps,
            "recommended_cfg": spec.default_cfg,
            "recommended_size": spec.default_size,
        },
    }


def loaded_model_id() -> str | None:
    return _loaded_model_id


def is_active() -> bool:
    return _ready or _loading
