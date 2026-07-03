"""Merged model catalog and lookup."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from qwen.models import ModelSpec as QwenSpec
from qwen.models import model_catalog as qwen_catalog
from sdxl.models import DEFAULT_MODEL_ID
from sdxl.models import ModelSpec as SdxlSpec
from sdxl.models import model_catalog as sdxl_catalog

if TYPE_CHECKING:
    ModelSpec = QwenSpec | SdxlSpec
else:
    ModelSpec = QwenSpec

DEFAULT_MODEL_ID = os.environ.get("CYBRIA_DEFAULT_MODEL", DEFAULT_MODEL_ID)


def model_catalog() -> list[ModelSpec]:
    return [*qwen_catalog(), *sdxl_catalog()]


def get_model(model_id: str | None) -> ModelSpec:
    mid = (model_id or DEFAULT_MODEL_ID).strip()
    for spec in model_catalog():
        if spec.id == mid:
            return spec
    raise KeyError(f"Unknown model id: {mid}")


def backend_for_family(family: str) -> str:
    if family == "qwen":
        return "qwen"
    if family in ("sdxl", "sd15"):
        return "sdxl"
    raise RuntimeError(f"Unsupported model family: {family}")
