"""Load global model storage paths from .tools/model-paths.json."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_TOOLS = Path(__file__).resolve().parent.parent
if str(_REPO_TOOLS) not in sys.path:
    sys.path.insert(0, str(_REPO_TOOLS))

from model_paths_lib import ensure_model_dirs, get_path, load_model_paths

__all__ = ["ensure_model_dirs", "get_path", "load_model_paths", "summarization_dir"]


def summarization_dir() -> Path:
    return get_path("summarization", "CYBRIA_SUMMARIZE_DIR")
