"""Summarization model catalog."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from model_paths import summarization_dir


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    repo_id: str
    max_input_chars: int = 1024
    default_max_length: int = 128
    default_min_length: int = 30


MODELS: list[ModelSpec] = [
    ModelSpec(
        id="pegasus-xsum",
        name="PEGASUS XSum",
        repo_id="google/pegasus-xsum",
        max_input_chars=1024,
        default_max_length=64,
        default_min_length=10,
    ),
    ModelSpec(
        id="bart-large-cnn",
        name="BART Large CNN",
        repo_id="facebook/bart-large-cnn",
        max_input_chars=1024,
        default_max_length=142,
        default_min_length=56,
    ),
]

DEFAULT_MODEL_ID = "bart-large-cnn"


def get_model(model_id: str) -> ModelSpec:
    for m in MODELS:
        if m.id == model_id:
            return m
    raise KeyError(f"Unknown model: {model_id}")


def model_local_dir(model_id: str) -> Path:
    return summarization_dir() / model_id


def model_catalog() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in MODELS:
        local = model_local_dir(m.id)
        installed = local.is_dir() and any(local.iterdir())
        out.append(
            {
                "id": m.id,
                "name": m.name,
                "repo_id": m.repo_id,
                "installed": installed,
                "local_dir": str(local),
            }
        )
    return out
