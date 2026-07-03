"""Route diffusers/transformers logs to stdout."""

from __future__ import annotations

import logging
import sys


def configure_library_logging() -> None:
    for mod in ("diffusers.utils", "transformers.utils"):
        try:
            liblog = __import__(mod, fromlist=["logging"]).logging
            liblog.set_verbosity_info()
            liblog.disable_default_handler()
            liblog.enable_progress_bar()
        except Exception:
            pass

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter("%(name)s: %(message)s"))
    for lib in ("diffusers", "transformers", "huggingface_hub", "accelerate", "safetensors"):
        lg = logging.getLogger(lib)
        lg.setLevel(logging.INFO)
        lg.addHandler(handler)
        lg.propagate = False
