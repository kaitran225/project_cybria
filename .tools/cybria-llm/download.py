"""Download GGUF weights from Hugging Face into G:\\.models\\llm."""

from __future__ import annotations

import argparse
import sys

from huggingface_hub import hf_hub_download, list_repo_files

from models import get_model, model_storage_dir
from model_paths import ensure_model_dirs


def download_model(model_id: str, quant: str | None = None) -> str:
    ensure_model_dirs()
    spec = get_model(model_id)
    dest = model_storage_dir(model_id)
    dest.mkdir(parents=True, exist_ok=True)

    q = (quant or spec.recommended_quant).upper()
    files = list_repo_files(spec.repo_id)
    gguf_files = [f for f in files if f.lower().endswith(".gguf")]
    if not gguf_files:
        raise RuntimeError(f"No GGUF files in {spec.repo_id}")

    preferred = [f for f in gguf_files if q in f.upper()]
    chosen = preferred[0] if preferred else gguf_files[0]
    print(f"[download] {spec.repo_id} -> {chosen}")

    path = hf_hub_download(
        repo_id=spec.repo_id,
        filename=chosen,
        local_dir=str(dest),
        local_dir_use_symlinks=False,
    )
    print(f"[download] saved {path}")
    return path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("model_id")
    parser.add_argument("--quant", default="")
    args = parser.parse_args()
    try:
        download_model(args.model_id, args.quant or None)
    except Exception as exc:
        print(f"[download] error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
