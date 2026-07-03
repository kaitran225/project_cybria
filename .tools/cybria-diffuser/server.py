"""Cybria diffusion — unified Qwen + SDXL API."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from common.app import run

if __name__ == "__main__":
    run("all")
