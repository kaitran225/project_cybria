#!/usr/bin/env python3
"""Build all Obsidian plugins under .obsidian/plugins/."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
PLUGINS = SCRIPTS.parent / "plugins"


def run(cmd: list[str], cwd: Path) -> None:
    print(f"  $ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=True)


def build_plugin(
    name: str,
    *,
    install_args: list[str] | None = None,
    post_copy: tuple[Path, Path] | None = None,
    verify: Path | None = None,
) -> None:
    plugin_dir = PLUGINS / name
    if not plugin_dir.is_dir():
        raise FileNotFoundError(f"plugin not found: {plugin_dir}")
    print(f"\n=== Building {name} ===")
    install = ["npm", "install", *(install_args or [])]
    run(install, plugin_dir)
    run(["npm", "run", "build"], plugin_dir)
    if post_copy:
        src, dst = post_copy
        full_src = plugin_dir / src
        if full_src.is_file():
            full_dst = plugin_dir / dst
            full_dst.write_bytes(full_src.read_bytes())
            print(f"  copied {src} -> {dst}")
    if verify and not (plugin_dir / verify).is_file():
        raise FileNotFoundError(f"{name} build missing {verify}")


def main() -> int:
    build_plugin("obsidian-style-settings")
    build_plugin("tasks-map")
    build_plugin("obsidian-tasks", install_args=["--legacy-peer-deps", "--ignore-scripts"])
    build_plugin(
        "dataview",
        post_copy=(Path("build/main.js"), Path("main.js")),
    )
    build_plugin("obsidian-color-palette", install_args=["--legacy-peer-deps"])
    build_plugin(
        "obsidian-code-suite",
        install_args=["--legacy-peer-deps"],
        post_copy=(Path("dist/main.js"), Path("main.js")),
    )
    build_plugin("obsidian-creases", install_args=["--legacy-peer-deps"])
    build_plugin("obsidian-people-graph")
    build_plugin("obsidian-cybria-core")
    build_plugin("obsidian-pixode")
    build_plugin(
        "obsidian-cote-studio",
        install_args=["--legacy-peer-deps"],
        verify=Path("repl-chunk.js"),
    )
    print("\nAll plugins built successfully.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"Build failed (exit {exc.returncode})", file=sys.stderr)
        raise SystemExit(exc.returncode) from exc
