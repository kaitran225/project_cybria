"""Deprecated — use .tools/cybria-diffuser/server.py instead."""

from __future__ import annotations

import sys

if __name__ == "__main__":
    print(
        "qwen-image/server.py was replaced by cybria-diffuser.\n"
        "Run: .tools/cybria-diffuser/start.ps1\n"
        "  unified: server.py\n"
        "  qwen only: qwen/server.py\n"
        "  sdxl only: sdxl/server.py",
        file=sys.stderr,
    )
    raise SystemExit(1)
