"""SDXL / SD1.5 pipeline load and generation."""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any

import torch
from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline

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
)
from sdxl.models import ModelSpec, model_catalog

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
_active_style_lora: str | None = None
_offload_mode = "none"
_vae_tiling = False
_lora_catalog: list[LoraEntry] = []


def refresh_lora_catalog() -> list[LoraEntry]:
    global _lora_catalog
    _lora_catalog = scan_loras(resolve_lora_dir())
    return _lora_catalog


def unload() -> None:
    global _pipe, _ready, _loaded_model_id, _active_spec, _active_style_lora, _load_error
    with _pipe_lock:
        if _pipe is not None:
            del _pipe
        _pipe = None
        _ready = False
        _loaded_model_id = None
        _active_spec = None
        _active_style_lora = None
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


def _load_scheduler(repo_id: str) -> Any:
    from huggingface_hub import hf_hub_download

    from diffusers import schedulers as diffusers_schedulers

    def _build() -> Any:
        cfg_path = hf_hub_download(repo_id, "scheduler/config.json")
        with open(cfg_path, encoding="utf-8") as f:
            cfg = json.load(f)
        cls_name = cfg.get("_class_name", "EulerDiscreteScheduler")
        cls = getattr(diffusers_schedulers, cls_name)
        return cls.from_pretrained(repo_id, subfolder="scheduler")

    return load_logged("scheduler", _build)


def _build_sdxl_pipeline(repo_id: str, dtype: torch.dtype, variant: str | None) -> Any:
    from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer

    from diffusers import AutoencoderKL, UNet2DConditionModel

    base = dict(torch_dtype=dtype, use_safetensors=True)
    var = {**base, "variant": variant} if variant else base

    tokenizer = load_logged(
        "tokenizer", lambda: CLIPTokenizer.from_pretrained(repo_id, subfolder="tokenizer")
    )
    tokenizer_2 = load_logged(
        "tokenizer_2", lambda: CLIPTokenizer.from_pretrained(repo_id, subfolder="tokenizer_2")
    )
    text_encoder = load_logged(
        "text_encoder",
        lambda: CLIPTextModel.from_pretrained(repo_id, subfolder="text_encoder", **base),
        heartbeat=True,
    )
    text_encoder_2 = load_logged(
        "text_encoder_2",
        lambda: CLIPTextModelWithProjection.from_pretrained(
            repo_id, subfolder="text_encoder_2", **base
        ),
        heartbeat=True,
    )
    unet = load_logged(
        "unet",
        lambda: UNet2DConditionModel.from_pretrained(repo_id, subfolder="unet", **var),
        heartbeat=True,
    )
    vae = load_logged(
        "vae",
        lambda: AutoencoderKL.from_pretrained(repo_id, subfolder="vae", **var),
        heartbeat=True,
    )
    scheduler = _load_scheduler(repo_id)

    log("[load] assembling SDXL pipeline")
    return StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler,
    )


def _build_sd15_pipeline(repo_id: str, dtype: torch.dtype, variant: str | None) -> Any:
    from transformers import CLIPTextModel, CLIPTokenizer

    from diffusers import AutoencoderKL, UNet2DConditionModel

    base = dict(torch_dtype=dtype, use_safetensors=True)
    var = {**base, "variant": variant} if variant else base

    tokenizer = load_logged(
        "tokenizer", lambda: CLIPTokenizer.from_pretrained(repo_id, subfolder="tokenizer")
    )
    text_encoder = load_logged(
        "text_encoder",
        lambda: CLIPTextModel.from_pretrained(repo_id, subfolder="text_encoder", **var),
        heartbeat=True,
    )
    unet = load_logged(
        "unet",
        lambda: UNet2DConditionModel.from_pretrained(repo_id, subfolder="unet", **var),
        heartbeat=True,
    )
    vae = load_logged(
        "vae",
        lambda: AutoencoderKL.from_pretrained(repo_id, subfolder="vae", **var),
        heartbeat=True,
    )
    scheduler = _load_scheduler(repo_id)

    log("[load] assembling SD1.5 pipeline")
    return StableDiffusionPipeline(
        vae=vae,
        text_encoder=text_encoder,
        tokenizer=tokenizer,
        unet=unet,
        scheduler=scheduler,
        safety_checker=None,
        requires_safety_checker=False,
    )


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
    if not lora_id:
        if _active_style_lora is not None:
            _purge_style_lora(pipe)
        return warnings

    entry = get_lora(lora_id, resolve_lora_dir())
    if entry is None:
        warnings.append(f"LoRA '{lora_id}' not found")
        return warnings

    ok, reason = entry.compat_reason(spec.family)
    if not ok:
        warnings.append(f"LoRA '{entry.name}' skipped: {reason}")
        return warnings

    _ensure_style_lora(pipe, entry)
    if hasattr(pipe, "set_adapters"):
        pipe.set_adapters([STYLE_ADAPTER], adapter_weights=[max(0.0, min(2.0, lora_scale))])
    return warnings


def _load_sdxl(spec: ModelSpec) -> Any:
    global _offload_mode, _active_style_lora, _vae_tiling
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    log(f"[load] sdxl {spec.repo_id} cuda={torch.cuda.is_available()}")

    def _build() -> Any:
        for variant in ("fp16", None):
            try:
                log(
                    f"[load] fetching SDXL components for {spec.id}"
                    + (f" (variant={variant})" if variant else " (default precision)")
                )
                return _build_sdxl_pipeline(spec.repo_id, dtype, variant)
            except Exception as exc:
                if variant is None:
                    raise
                log(f"[load] no fp16 variant ({exc}); trying default precision")
        raise RuntimeError("unreachable")

    pipe = _build()
    log(f"[load] weights ready for {spec.id}")
    if torch.cuda.is_available():
        pipe.enable_model_cpu_offload()
        _offload_mode = "cpu_offload"
        log("[load] SDXL CPU offload")
    else:
        pipe.to("cpu")
        _offload_mode = "cpu"
    _vae_tiling = apply_memory_opts(pipe)
    _active_style_lora = None
    return pipe


def _load_sd15(spec: ModelSpec) -> Any:
    global _offload_mode, _active_style_lora, _vae_tiling
    cuda = torch.cuda.is_available()
    dtype = torch.float16 if cuda else torch.float32
    log(f"[load] sd15 {spec.repo_id} cuda={cuda}")

    def _build() -> Any:
        for variant in ("fp16", None):
            try:
                log(
                    f"[load] fetching SD1.5 weights for {spec.id}"
                    + (f" (variant={variant})" if variant else " (default precision)")
                )
                return _build_sd15_pipeline(spec.repo_id, dtype, variant)
            except Exception as exc:
                if variant is None:
                    raise
                log(f"[load] no fp16 variant ({exc}); trying default precision")
        raise RuntimeError("unreachable")

    pipe = _build()
    log(f"[load] weights ready for {spec.id}")
    if cuda:
        try:
            pipe.to("cuda")
            _offload_mode = "full_gpu"
            log("[load] SD1.5 on GPU (full)")
        except torch.cuda.OutOfMemoryError:
            clear_cuda()
            pipe.enable_model_cpu_offload()
            _offload_mode = "cpu_offload"
            log("[load] SD1.5 CPU offload (low VRAM fallback)")
        pipe.enable_attention_slicing()
    else:
        pipe.to("cpu")
        _offload_mode = "cpu"
    _vae_tiling = apply_memory_opts(pipe)
    _active_style_lora = None
    return pipe


def load_pipeline(model_id: str) -> Any:
    global _loading, _load_error, _pending_model_id
    spec = next(m for m in model_catalog() if m.id == model_id)
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
        log(f"[load] loading {spec.id} ({spec.family})…")

    with _pipe_lock:
        _loading = True
        _load_error = None

    try:
        t0 = time.time()
        if spec.family == "sdxl":
            pipe = _load_sdxl(spec)
        elif spec.family == "sd15":
            pipe = _load_sd15(spec)
        else:
            raise RuntimeError(f"Unsupported SD family: {spec.family}")

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
                "prompt": body.prompt.strip(),
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
        "lightning": False,
        "active_style_lora": _active_style_lora,
        "lora_directory": str(resolve_lora_dir()),
        "backend": "sdxl",
        "optimizations": {
            "offload": _offload_mode,
            "compile": False,
            "attention": "default",
            "vae_tiling": _vae_tiling,
            "lightning_weight": None,
        },
        "config": {
            "model": spec.repo_id,
            "model_id": spec.id,
            "max_side": spec.max_side,
            "host": host,
            "port": port,
            "lightning": False,
            "recommended_steps": spec.default_steps,
            "recommended_cfg": spec.default_cfg,
            "recommended_size": spec.default_size,
        },
    }


def loaded_model_id() -> str | None:
    return _loaded_model_id


def is_active() -> bool:
    return _ready or _loading
