"""Emit JSON readiness."""

from __future__ import annotations

import importlib.util
import json
import sys


def main() -> None:
    errors: list[str] = []
    for pkg in ("fastapi", "uvicorn", "httpx"):
        if importlib.util.find_spec(pkg) is None:
            errors.append(f"missing package: {pkg}")
    out = {"ok": len(errors) == 0, "python": sys.version.split()[0], "errors": errors}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
