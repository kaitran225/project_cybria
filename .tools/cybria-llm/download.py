"""Download GGUF weights from Hugging Face into the configured LLM model dir."""

from __future__ import annotations

import argparse
import os
import sys

from huggingface_hub import hf_hub_download, list_repo_files

from console import log, log_err, log_ok
from models import get_model, model_storage_dir
from model_paths import ensure_model_dirs

# Faster parallel downloads when hf_transfer is installed.
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")


def download_model(model_id: str, quant: str | None = None) -> str:
    ensure_model_dirs()
    spec = get_model(model_id)
    dest = model_storage_dir(model_id)
    dest.mkdir(parents=True, exist_ok=True)

    q = (quant or spec.recommended_quant).upper()
    log("download", f"listing {spec.repo_id} …")
    files = list_repo_files(spec.repo_id)
    gguf_files = [f for f in files if f.lower().endswith(".gguf")]
    if not gguf_files:
        raise RuntimeError(f"No GGUF files in {spec.repo_id}")

    preferred = [f for f in gguf_files if q in f.upper()]
    chosen = preferred[0] if preferred else gguf_files[0]
    log("download", f"{spec.repo_id} → {chosen}")

    path = hf_hub_download(
        repo_id=spec.repo_id,
        filename=chosen,
        local_dir=str(dest),
    )
    log_ok("download", f"saved {path}")
    return path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("model_id")
    parser.add_argument("--quant", default="")
    args = parser.parse_args()
    try:
        download_model(args.model_id, args.quant or None)
    except Exception as exc:
        log_err("download", str(exc))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
