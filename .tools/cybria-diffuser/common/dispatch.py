"""Route requests to the Qwen or SDXL backend."""

from __future__ import annotations

import threading

from common.catalog import DEFAULT_MODEL_ID, backend_for_family, get_model, model_catalog
from common.schemas import GenerateBody
from common.loras import resolve_lora_dir, scan_loras
import qwen.pipeline as qwen_backend
import sdxl.pipeline as sdxl_backend

_load_lock = threading.Lock()


def _backend_module(family: str):
    return qwen_backend if backend_for_family(family) == "qwen" else sdxl_backend


def load_model_async(model_id: str) -> None:
    spec = get_model(model_id)
    other = sdxl_backend if backend_for_family(spec.family) == "qwen" else qwen_backend

    def _run() -> None:
        with _load_lock:
            other.unload()
            _backend_module(spec.family).load_pipeline(model_id)

    threading.Thread(target=_run, daemon=True).start()


def is_loading(model_id: str) -> bool:
    spec = get_model(model_id)
    mod = _backend_module(spec.family)
    return mod._loading  # noqa: SLF001 — shared state


def generate(body: GenerateBody) -> dict:
    spec = get_model(body.model or qwen_backend.loaded_model_id() or sdxl_backend.loaded_model_id() or DEFAULT_MODEL_ID)
    return _backend_module(spec.family).generate(body, spec)


def health(host: str, port: int) -> dict[str, object]:
    if qwen_backend.is_active():
        return qwen_backend.health(host, port, DEFAULT_MODEL_ID)
    if sdxl_backend.is_active():
        return sdxl_backend.health(host, port, DEFAULT_MODEL_ID)
    return sdxl_backend.health(host, port, DEFAULT_MODEL_ID)


def list_loras(model: str | None, refresh: bool) -> dict[str, object]:
    from common.loras import LoraEntry

    entries = scan_loras(resolve_lora_dir()) if refresh else (
        qwen_backend._lora_catalog or sdxl_backend._lora_catalog or scan_loras(resolve_lora_dir())  # noqa: SLF001
    )
    lora_dir = resolve_lora_dir()
    try:
        spec = get_model(model or qwen_backend.loaded_model_id() or sdxl_backend.loaded_model_id() or DEFAULT_MODEL_ID)
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
