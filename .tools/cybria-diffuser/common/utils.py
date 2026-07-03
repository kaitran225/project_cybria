"""Shared helpers for pipeline load and generation."""

from __future__ import annotations

import gc
import random
import threading
import time
from typing import Any, Callable

import torch


def log(msg: str) -> None:
    print(msg, flush=True)


def gpu_mem_gb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    return torch.cuda.get_device_properties(0).total_memory / (1024**3)


def cap_dim(value: int, max_side: int) -> int:
    return max(256, min(max_side, value // 64 * 64))


def resolve_seed(seed: str | None) -> int:
    if seed is None or seed.strip() == "":
        return random.randint(0, 2**31 - 1)
    try:
        return int(seed)
    except ValueError:
        return int.from_bytes(seed.encode("utf-8")[:4], "little") % (2**31)


def clear_cuda() -> None:
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


def apply_cuda_runtime() -> None:
    if not torch.cuda.is_available():
        return
    torch.backends.cudnn.benchmark = True
    torch.set_float32_matmul_precision("high")
    if hasattr(torch.backends.cuda, "enable_flash_sdp"):
        torch.backends.cuda.enable_flash_sdp(True)
    if hasattr(torch.backends.cuda, "enable_mem_efficient_sdp"):
        torch.backends.cuda.enable_mem_efficient_sdp(True)


def run_with_heartbeat(label: str, fn: Callable[[], Any]) -> Any:
    result: list[Any] = []
    error: list[BaseException] = []

    def worker() -> None:
        try:
            result.append(fn())
        except BaseException as exc:
            error.append(exc)

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t0 = time.time()
    while t.is_alive():
        t.join(timeout=5.0)
        if t.is_alive():
            elapsed = time.time() - t0
            hint = " (heavy model on low VRAM — this can take a few minutes)" if elapsed >= 20 else ""
            log(f"[load] {label} — still working, {elapsed:.0f}s{hint}")
    if error:
        raise error[0]
    return result[0]


def load_logged(label: str, fn: Callable[[], Any], *, heartbeat: bool = False) -> Any:
    log(f"[load] → {label}")
    t0 = time.time()
    out = run_with_heartbeat(label, fn) if heartbeat else fn()
    log(f"[load] ✓ {label} ({time.time() - t0:.1f}s)")
    return out


def make_progress_callback(total: int, label: str) -> Any:
    state = {"last": 0.0}

    def _cb(_pipe: Any, step: int, _timestep: Any, cbk: dict[str, Any]) -> dict[str, Any]:
        now = time.time()
        done = step + 1
        if done >= total or now - state["last"] >= 1.0:
            state["last"] = now
            pct = int(done / total * 100)
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            log(f"[generate] {label} {bar} {pct}% ({done}/{total})")
        return cbk

    return _cb


def oom_fallback_sizes(width: int, height: int, max_side: int) -> list[tuple[int, int]]:
    sizes: list[tuple[int, int]] = [(width, height)]
    fallback = min(512, max_side)
    if width > fallback or height > fallback:
        scale = fallback / max(width, height)
        w = max(256, int(width * scale) // 64 * 64)
        h = max(256, int(height * scale) // 64 * 64)
        sizes.append((cap_dim(w, max_side), cap_dim(h, max_side)))
    return sizes


def run_inference(pipe: Any, family: str, kwargs: dict[str, Any], progress: Any = None) -> Any:
    if progress is not None:
        kwargs = dict(kwargs)
        kwargs["callback_on_step_end"] = progress
    if family in ("sdxl", "sd15"):
        kwargs = dict(kwargs)
        cfg = kwargs.pop("true_cfg_scale", kwargs.get("guidance_scale", 7.5))
        kwargs["guidance_scale"] = cfg
        try:
            return pipe(**kwargs)
        except TypeError:
            kwargs.pop("callback_on_step_end", None)
            return pipe(**kwargs)
    try:
        return pipe(**kwargs)
    except TypeError:
        kwargs = dict(kwargs)
        kwargs.pop("true_cfg_scale", None)
        kwargs.pop("callback_on_step_end", None)
        kwargs["guidance_scale"] = kwargs.get("guidance_scale", 1.0)
        return pipe(**kwargs)


def apply_memory_opts(pipe: Any) -> bool:
    vae = getattr(pipe, "vae", None)
    if vae is not None and hasattr(vae, "enable_tiling"):
        vae.enable_tiling()
        log("[load] VAE tiling enabled")
        return True
    return False
