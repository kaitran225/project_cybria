"""API request bodies."""

from __future__ import annotations

import os

from pydantic import BaseModel, Field

DEFAULT_LORA_SCALE = float(os.environ.get("QWEN_LORA_DEFAULT_SCALE", "0.85"))


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


class LoadModelBody(BaseModel):
    model_id: str = Field(alias="model_id")

    model_config = {"populate_by_name": True}
