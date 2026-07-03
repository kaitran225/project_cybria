"""Cross-platform CLI for Cybria Python services."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent.parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from cybria_cli.runner import (
    install_cuda_torch,
    install_requirements,
    run_server,
    service_env,
)
from cybria_cli.services import list_services, resolve


def cmd_list(_args: argparse.Namespace) -> int:
    for spec in list_services():
        msg = f"  {spec.folder}"
        if spec.setup_message:
            msg += f" — {spec.setup_message}"
        print(msg)
    print("\nRun: python -m cybria_cli run <folder>")
    print("Setup: python -m cybria_cli setup <folder> [--cuda-torch]")
    return 0


def cmd_setup(args: argparse.Namespace) -> int:
    spec = resolve(args.service)
    env = service_env(spec.dir, spec.extra_env) if spec.extra_env else None
    install_requirements(spec.dir, env=env)
    if args.cuda_torch or spec.cuda_torch_on_setup:
        install_cuda_torch(spec.dir, index=args.cuda_index)
    print(f"[cybria] setup complete: {spec.folder}", flush=True)
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    spec = resolve(args.service)
    if not args.skip_setup:
        env = service_env(spec.dir, spec.extra_env) if spec.extra_env else None
        install_requirements(spec.dir, env=env)
        if args.cuda_torch:
            install_cuda_torch(spec.dir, index=args.cuda_index)
    if spec.setup_message:
        print(spec.setup_message, flush=True)
    return run_server(spec.dir, spec.extra_env)


def cmd_env(_args: argparse.Namespace) -> int:
    """Print exportable env lines (for shell debugging)."""
    if str(_TOOLS) not in sys.path:
        sys.path.insert(0, str(_TOOLS))
    from model_paths_lib import model_path_env

    for key, value in model_path_env().items():
        if value:
            print(f"{key}={value}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="cybria_cli",
        description="Setup and run Cybria .tools Python services (cross-platform).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List service folders").set_defaults(func=cmd_list)

    p_setup = sub.add_parser("setup", help="Create venv and install requirements")
    p_setup.add_argument("service", help="Service folder name, e.g. cybria-diffuser")
    p_setup.add_argument(
        "--cuda-torch",
        action="store_true",
        help="Install PyTorch CUDA wheels (recommended for cybria-diffuser)",
    )
    p_setup.add_argument("--cuda-index", default="cu124", help="PyTorch wheel index tag")
    p_setup.set_defaults(func=cmd_setup)

    p_run = sub.add_parser("run", help="Install deps if needed and start server.py")
    p_run.add_argument("service", help="Service folder name, e.g. cybria-server")
    p_run.add_argument(
        "--skip-setup",
        action="store_true",
        help="Do not pip install before launch",
    )
    p_run.add_argument(
        "--cuda-torch",
        action="store_true",
        help="Install PyTorch CUDA wheels before launch",
    )
    p_run.add_argument("--cuda-index", default="cu124", help="PyTorch wheel index tag")
    p_run.set_defaults(func=cmd_run)

    sub.add_parser("env", help="Print model-path env vars to stdout").set_defaults(func=cmd_env)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130
    except subprocess.CalledProcessError as exc:
        return exc.returncode
    except Exception as exc:
        print(f"[cybria] error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
