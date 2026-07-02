"""Built-in and Hugging Face base model catalog."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass

DEFAULT_MODEL_ID = os.environ.get("QWEN_DEFAULT_MODEL", "qwen-lightning")
QWEN_REPO = os.environ.get(
    "QWEN_IMAGE_MODEL", "unsloth/Qwen-Image-2512-unsloth-bnb-4bit"
)


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    repo_id: str
    family: str  # qwen | sdxl
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
        ModelSpec(
            id="heartsync-nsfw",
            name="Heartsync NSFW Uncensored",
            repo_id="Heartsync/NSFW-Uncensored",
            family="sdxl",
            lightning=False,
            default_steps=25,
            default_cfg=7.5,
            default_size=768,
            max_side=768,
            source="huggingface",
            note="SDXL from Hugging Face — first load downloads ~6GB",
        ),
        ModelSpec(
            id="nsfw-gen-v2",
            name="UnfilteredAI NSFW-gen v2",
            repo_id="UnfilteredAI/NSFW-gen-v2",
            family="sdxl",
            lightning=False,
            default_steps=20,
            default_cfg=6.0,
            default_size=768,
            max_side=768,
            source="huggingface",
            note="Lightweight SDXL test — first load downloads ~6GB",
        ),
    ]


def get_model(model_id: str | None) -> ModelSpec:
    mid = (model_id or DEFAULT_MODEL_ID).strip()
    for spec in model_catalog():
        if spec.id == mid:
            return spec
    raise KeyError(f"Unknown model id: {mid}")
