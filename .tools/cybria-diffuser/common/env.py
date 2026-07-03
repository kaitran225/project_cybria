"""Bootstrap HF env and logging for diffusion servers."""

from __future__ import annotations

import os

from common.model_paths import apply_huggingface_env, ensure_model_dirs


def bootstrap() -> None:
    ensure_model_dirs()
    apply_huggingface_env()
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "0"
    os.environ["TQDM_DISABLE"] = "0"
    try:
        from huggingface_hub.utils import enable_progress_bars

        enable_progress_bars()
    except Exception:
        pass
