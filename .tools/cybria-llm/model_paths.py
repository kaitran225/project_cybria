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


def llm_dir() -> Path:
    raw = os.environ.get("CYBRIA_LLM_DIR", "").strip()
    if raw:
        return Path(raw)
    return Path(load_model_paths()["llm"])


def ensure_model_dirs() -> None:
    for p in load_model_paths().values():
        Path(p).mkdir(parents=True, exist_ok=True)
