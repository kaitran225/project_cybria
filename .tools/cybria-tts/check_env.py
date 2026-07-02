"""Emit JSON readiness."""

from __future__ import annotations

import importlib.util
import json
import shutil
import sys


def main() -> None:
    errors: list[str] = []
    for pkg in ("fastapi", "uvicorn", "httpx"):
        if importlib.util.find_spec(pkg) is None:
            errors.append(f"missing package: {pkg}")
    if shutil.which("vllm") is None:
        vllm_exe = None
        try:
            from pathlib import Path

            candidate = Path(sys.executable).parent / "vllm.exe"
            if candidate.is_file():
                vllm_exe = str(candidate)
        except Exception:
            pass
        if not vllm_exe:
            errors.append("missing vllm (pip install vllm-omni)")
    out = {"ok": len(errors) == 0, "python": sys.version.split()[0], "errors": errors}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
