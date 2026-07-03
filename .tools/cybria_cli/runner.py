"""Cross-platform setup and run helpers for Cybria .tools services."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

TOOLS_ROOT = Path(__file__).resolve().parent.parent


def venv_python(service_dir: Path) -> Path:
    if sys.platform == "win32":
        return service_dir / ".venv" / "Scripts" / "python.exe"
    return service_dir / ".venv" / "bin" / "python"


def venv_pip(service_dir: Path) -> Path:
    if sys.platform == "win32":
        return service_dir / ".venv" / "Scripts" / "pip.exe"
    return service_dir / ".venv" / "bin" / "pip"


def _venv_create_commands(service_dir: Path) -> list[list[str]]:
    venv_path = str(service_dir / ".venv")
    if sys.platform == "win32":
        cmds: list[list[str]] = [
            ["py", f"-{ver}", "-m", "venv", venv_path]
            for ver in ("3.13", "3.12", "3.11", "3.10", "3")
        ]
        cmds.extend(
            [
                ["py", "-m", "venv", venv_path],
                ["python", "-m", "venv", venv_path],
                ["python3", "-m", "venv", venv_path],
            ]
        )
        return cmds
    return [
        ["python3", "-m", "venv", venv_path],
        ["python", "-m", "venv", venv_path],
    ]


def ensure_venv(service_dir: Path, *, python_version: str = "3.12") -> Path:
    py = venv_python(service_dir)
    if py.is_file():
        return py

    service_dir.mkdir(parents=True, exist_ok=True)
    # Prefer detected version, then common fallbacks (user may only have 3.13, etc.)
    preferred = (
        [f"3.{python_version.split('.')[-1]}"]
        if python_version.startswith("3.")
        else [python_version]
    )
    seen: set[tuple[str, ...]] = set()
    commands: list[list[str]] = []
    venv_path = str(service_dir / ".venv")
    if sys.platform == "win32":
        for ver in (*preferred, "3.13", "3.12", "3.11", "3.10", "3"):
            cmd = ("py", f"-{ver}", "-m", "venv", venv_path)
            if cmd not in seen:
                seen.add(cmd)
                commands.append(list(cmd))
        for tail in (
            ("py", "-m", "venv", venv_path),
            ("python", "-m", "venv", venv_path),
            ("python3", "-m", "venv", venv_path),
        ):
            if tail not in seen:
                seen.add(tail)
                commands.append(list(tail))
    else:
        commands = _venv_create_commands(service_dir)

    last_err: subprocess.CalledProcessError | None = None
    for cmd in commands:
        print(f"[cybria] trying venv: {' '.join(cmd)}", flush=True)
        try:
            subprocess.run(cmd, cwd=service_dir, check=True, capture_output=True, text=True)
            if py.is_file():
                print(f"[cybria] venv ready: {py}", flush=True)
                return py
        except subprocess.CalledProcessError as exc:
            last_err = exc
            err = (exc.stderr or exc.stdout or "").strip()
            if err:
                print(f"[cybria]   skipped: {err.splitlines()[-1]}", flush=True)

    hint = (
        "Install Python 3.10+ and ensure `py` or `python` is on PATH."
        if sys.platform == "win32"
        else "Install python3 (3.10+) and ensure it is on PATH."
    )
    raise RuntimeError(f"Could not create venv in {service_dir}. {hint}") from last_err


def pip_install(
    service_dir: Path,
    *args: str,
    env: dict[str, str] | None = None,
) -> None:
    py = ensure_venv(service_dir)
    cmd = [str(py), "-m", "pip", "install", *args]
    print(f"[cybria] {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, cwd=service_dir, check=True, env=env)


def install_requirements(service_dir: Path, env: dict[str, str] | None = None) -> None:
    req = service_dir / "requirements.txt"
    if not req.is_file():
        raise FileNotFoundError(f"requirements.txt not found in {service_dir}")
    pip_install(service_dir, "-r", "requirements.txt", env=env)


def install_cuda_torch(service_dir: Path, *, index: str = "cu124") -> None:
    """Install PyTorch with CUDA wheels (not CPU-only default from PyPI)."""
    py = ensure_venv(service_dir)
    pip = str(venv_pip(service_dir))
    index_url = f"https://download.pytorch.org/whl/{index}"
    print(f"[cybria] reinstalling torch from {index_url}", flush=True)
    subprocess.run([pip, "uninstall", "torch", "-y"], cwd=service_dir, check=False)
    subprocess.run(
        [pip, "install", "torch", "--index-url", index_url],
        cwd=service_dir,
        check=True,
    )
    out = subprocess.run(
        [
            str(py),
            "-c",
            "import torch; print('torch', torch.__version__); "
            "print('cuda', torch.cuda.is_available())",
        ],
        cwd=service_dir,
        capture_output=True,
        text=True,
    )
    if out.stdout:
        print(out.stdout.strip(), flush=True)


def service_env(service_dir: Path, extra: dict[str, str] | None = None) -> dict[str, str]:
    if str(TOOLS_ROOT) not in sys.path:
        sys.path.insert(0, str(TOOLS_ROOT))
    from model_paths_lib import ensure_model_dirs, model_path_env

    ensure_model_dirs()
    env = {**os.environ, **model_path_env()}
    env.setdefault("PYTHONUNBUFFERED", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")
    if extra:
        env.update(extra)
    return env


def run_server(service_dir: Path, extra_env: dict[str, str] | None = None) -> int:
    py = ensure_venv(service_dir)
    server = service_dir / "server.py"
    if not server.is_file():
        raise FileNotFoundError(f"server.py not found in {service_dir}")
    env = service_env(service_dir, extra_env)
    cmd = [str(py), "-u", str(server)]
    print(f"[cybria] {' '.join(cmd)}", flush=True)
    print(f"[cybria] cwd: {service_dir}", flush=True)
    return subprocess.call(cmd, cwd=service_dir, env=env)
