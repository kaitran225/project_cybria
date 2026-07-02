"""Load global model storage paths."""

from __future__ import annotations

import json
import os
from pathlib import Path

_TOOLS_DIR = Path(__file__).resolve().parent
_CONFIG_PATH = _TOOLS_DIR.parent / "model-paths.json"

_DEFAULTS = {"tts": r"G:\.models\tts"}


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


def tts_dir() -> Path:
    raw = os.environ.get("CYBRIA_TTS_DIR", "").strip()
    if raw:
        return Path(raw)
    return Path(load_model_paths()["tts"])


def ensure_model_dirs() -> None:
    tts_dir().mkdir(parents=True, exist_ok=True)
