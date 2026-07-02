"""Load global model storage paths from .tools/model-paths.json."""

from __future__ import annotations

import json
import os
from pathlib import Path

_TOOLS_DIR = Path(__file__).resolve().parent
_REPO_TOOLS = _TOOLS_DIR.parent
_CONFIG_PATH = _REPO_TOOLS / "model-paths.json"

_DEFAULTS = {
    "root": r"G:\.models",
    "loras": r"G:\.models\LoRa",
    "huggingface": r"G:\.models\Qwen",
    "llm": r"G:\.models\llm",
    "tts": r"G:\.models\tts",
    "summarization": r"G:\.models\summarization",
}


def load_model_paths() -> dict[str, str]:
    paths = dict(_DEFAULTS)
    if _CONFIG_PATH.is_file():
        try:
            with _CONFIG_PATH.open(encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                for key, raw in data.items():
                    if isinstance(raw, str) and raw.strip():
                        paths[key] = raw.strip()
        except (OSError, json.JSONDecodeError):
            pass
    return paths


def _hub_cache_dir(hf_path: Path) -> Path:
    """Use existing HF hub layout (models--* at root) or default …/hub."""
    if any(hf_path.glob("models--*")):
        return hf_path
    hub = hf_path / "hub"
    if hub.is_dir() and any(hub.glob("models--*")):
        return hub
    return hub


def model_root() -> Path:
    return Path(load_model_paths()["root"])


def lora_dir() -> Path:
    raw = os.environ.get("QWEN_LORA_DIR", "").strip()
    if raw:
        return Path(raw)
    return Path(load_model_paths()["loras"])


def huggingface_home() -> Path:
    return Path(load_model_paths()["huggingface"])


def huggingface_hub_cache() -> Path:
    return _hub_cache_dir(huggingface_home())


def ensure_model_dirs() -> None:
    paths = load_model_paths()
    for p in paths.values():
        Path(p).mkdir(parents=True, exist_ok=True)
    huggingface_hub_cache().mkdir(parents=True, exist_ok=True)


def apply_huggingface_env() -> Path:
    """Point Hugging Face / diffusers downloads at the configured cache."""
    hf_home = huggingface_home()
    hub = huggingface_hub_cache()
    hf_home.mkdir(parents=True, exist_ok=True)
    hub.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(load_model_paths()["root"]))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(hub))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(hub))
    os.environ.setdefault("DIFFUSERS_CACHE", str(hub))
    return hub
