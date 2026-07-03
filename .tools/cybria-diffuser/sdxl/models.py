"""Stable Diffusion XL / 1.5 model catalog."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass

DEFAULT_MODEL_ID = os.environ.get("CYBRIA_SDXL_DEFAULT_MODEL", "dreamshaper-8")


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
            id="dreamshaper-8",
            name="DreamShaper 8 (SD1.5)",
            repo_id="Lykon/dreamshaper-8",
            family="sd15",
            lightning=False,
            default_steps=25,
            default_cfg=7.0,
            default_size=512,
            max_side=768,
            source="huggingface",
            note="Lightweight SD1.5 — fast on 4GB VRAM, uncensored (~2GB)",
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
