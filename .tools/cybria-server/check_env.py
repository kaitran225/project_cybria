"""Check cybria-server gateway and sub-service venvs."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT.parent

SERVICES = ["cybria-llm", "cybria-summarize", "cybria-tts", "qwen-image"]


def _py(tools_dir: Path) -> Path:
    win = tools_dir / ".venv" / "Scripts" / "python.exe"
    return win if win.is_file() else tools_dir / ".venv" / "bin" / "python"


def main() -> int:
    errors: list[str] = []
    packages: dict[str, str] = {}
    python_ver = sys.version.split()[0]

    gw_py = _py(ROOT)
    if not gw_py.is_file():
        errors.append("cybria-server: venv missing — run Install deps")
    else:
        try:
            subprocess.run([str(gw_py), "-c", "import fastapi, httpx, uvicorn"], check=True, capture_output=True)
            packages["gateway"] = "ok"
        except subprocess.CalledProcessError:
            errors.append("cybria-server: pip install -r requirements.txt")

    for sub in SERVICES:
        d = TOOLS / sub
        py = _py(d)
        if not py.is_file():
            errors.append(f"{sub}: venv missing")
            continue
        r = subprocess.run(
            [str(py), "check_env.py"],
            cwd=str(d),
            capture_output=True,
            text=True,
        )
        line = (r.stdout or "").strip().splitlines()[-1] if r.stdout else ""
        try:
            data = json.loads(line) if line.startswith("{") else {}
            if not data.get("ok"):
                errors.extend(data.get("errors") or [f"{sub}: check_env failed"])
            packages[sub] = "ok" if data.get("ok") else "fail"
        except json.JSONDecodeError:
            if r.returncode != 0:
                errors.append(f"{sub}: check_env failed")

    out = {
        "ok": len(errors) == 0,
        "python": python_ver,
        "executable": str(gw_py) if gw_py.is_file() else "",
        "packages": packages,
        "errors": errors,
    }
    print(json.dumps(out))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
