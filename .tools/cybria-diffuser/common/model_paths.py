"""Load global model storage paths from .tools/model-paths.json."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_TOOLS = Path(__file__).resolve().parents[2]
if str(_REPO_TOOLS) not in sys.path:
    sys.path.insert(0, str(_REPO_TOOLS))

from model_paths_lib import (
    apply_huggingface_env,
    ensure_model_dirs,
    get_path,
    hub_cache_dir,
    load_model_paths,
)

__all__ = [
    "apply_huggingface_env",
    "ensure_model_dirs",
    "get_path",
    "hub_cache_dir",
    "huggingface_home",
    "huggingface_hub_cache",
    "load_model_paths",
    "lora_dir",
    "model_root",
]


def model_root() -> Path:
    return get_path("root")


def lora_dir() -> Path:
    return get_path("loras", "QWEN_LORA_DIR")


def huggingface_home() -> Path:
    return get_path("huggingface")


def huggingface_hub_cache() -> Path:
    return hub_cache_dir(huggingface_home())
