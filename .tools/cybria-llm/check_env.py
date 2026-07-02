"""Emit JSON readiness for the Obsidian server launcher."""

from __future__ import annotations

import importlib.util
import json
import sys


def _pkg_version(name: str) -> str:
    spec = importlib.util.find_spec(name)
    if spec is None:
        return "missing"
    try:
        mod = importlib.import_module(name)
        return getattr(mod, "__version__", "ok")
    except Exception:
        return "error"


def main() -> None:
    errors: list[str] = []
    for pkg in ("fastapi", "uvicorn", "httpx", "huggingface_hub", "llama_cpp"):
        if importlib.util.find_spec(pkg) is None:
            errors.append(f"missing package: {pkg}")

    out = {
        "ok": len(errors) == 0,
        "python": sys.version.split()[0],
        "executable": sys.executable,
        "packages": {
            "fastapi": _pkg_version("fastapi"),
            "uvicorn": _pkg_version("uvicorn"),
            "httpx": _pkg_version("httpx"),
            "huggingface_hub": _pkg_version("huggingface_hub"),
            "llama_cpp": _pkg_version("llama_cpp"),
        },
        "errors": errors,
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
