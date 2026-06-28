"""Print JSON env check for Obsidian image-gen sidebar."""

from __future__ import annotations

import json
import os
import sys

PACKAGES = [
    ("torch", "torch"),
    ("diffusers", "diffusers"),
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("accelerate", "accelerate"),
    ("bitsandbytes", "bitsandbytes"),
    ("PIL", "pillow"),
]


def main() -> int:
    model = os.environ.get(
        "QWEN_IMAGE_MODEL", "unsloth/Qwen-Image-2512-unsloth-bnb-4bit"
    )
    result: dict = {
        "ok": True,
        "python": sys.version.split()[0],
        "executable": sys.executable,
        "model": model,
        "max_side": int(os.environ.get("QWEN_IMAGE_MAX_SIDE", "768")),
        "packages": {},
        "errors": [],
    }
    for label, mod in PACKAGES:
        try:
            __import__(label if label != "PIL" else "PIL")
            result["packages"][label] = "ok"
        except Exception as exc:
            result["packages"][label] = str(exc)
            result["errors"].append(label)
            result["ok"] = False
    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
