"""Shared logging helpers for Cybria Python servers."""

from __future__ import annotations

import logging


class _SkipHealthAccess(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/health" not in record.getMessage()


def quiet_uvicorn() -> None:
    """Suppress uvicorn access lines for /health (belt-and-suspenders with access_log=False)."""
    flt = _SkipHealthAccess()
    for name in ("uvicorn.access", "uvicorn"):
        logging.getLogger(name).addFilter(flt)
