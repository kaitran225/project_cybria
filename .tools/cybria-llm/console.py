"""Colored console helpers for Cybria CLI scripts (Windows-safe)."""

from __future__ import annotations

import sys

from colorama import Fore, Style, init

init(autoreset=True)


def log(tag: str, message: str, *, color: str = Fore.CYAN, stream=None) -> None:
    out = stream or sys.stdout
    print(f"{color}[{tag}]{Style.RESET_ALL} {message}", file=out, flush=True)


def log_ok(tag: str, message: str) -> None:
    log(tag, message, color=Fore.GREEN)


def log_warn(tag: str, message: str) -> None:
    log(tag, message, color=Fore.YELLOW, stream=sys.stderr)


def log_err(tag: str, message: str) -> None:
    log(tag, message, color=Fore.RED, stream=sys.stderr)
