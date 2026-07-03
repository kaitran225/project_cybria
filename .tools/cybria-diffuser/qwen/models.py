"""Qwen Image model catalog."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass

QWEN_REPO = os.environ.get(
    "QWEN_IMAGE_MODEL", "unsloth/Qwen-Image-2512-unsloth-bnb-4bit"
)


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    repo_id: str
    family: str
    lightning: bool
    default_steps: int
    default_cfg: float
    default_size: int
    max_side: int
    source: str = "builtin"
    note: str | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def model_catalog() -> list[ModelSpec]:
    return [
        ModelSpec(
            id="qwen-lightning",
            name="Qwen Image (Lightning)",
            repo_id=QWEN_REPO,
            family="qwen",
            lightning=True,
            default_steps=8,
            default_cfg=1.0,
            default_size=512,
            max_side=int(os.environ.get("QWEN_IMAGE_MAX_SIDE", "512")),
            note="Fast — best for 8GB VRAM",
        ),
    ]
