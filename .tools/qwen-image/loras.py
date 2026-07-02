"""Scan local .safetensors and classify LoRA families."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from pathlib import Path

from safetensors import safe_open

from model_paths import lora_dir

QWEN_LORA_PREFIX = "lora_unet_transformer"


@dataclass(frozen=True)
class LoraEntry:
    id: str
    name: str
    filename: str
    path: str
    kind: str
    reason: str | None = None

    def compatible_with(self, family: str) -> bool:
        ok, _ = self.compat_reason(family)
        return ok

    def compat_reason(self, family: str) -> tuple[bool, str | None]:
        if family == "qwen":
            if self.kind == "qwen_lora":
                return True, None
            if self.kind == "sdxl_lora":
                return False, "SDXL LoRA — switch to an SDXL base model"
            if self.kind == "sd15_lora":
                return False, "SD 1.5 LoRA — not compatible with Qwen Image"
            return False, self.reason or "Not a Qwen Image LoRA"
        if family == "sdxl":
            if self.kind == "sdxl_lora":
                return True, None
            if self.kind == "qwen_lora":
                return False, "Qwen LoRA — switch to Qwen Image base model"
            return False, self.reason or "Not an SDXL LoRA"
        return False, self.reason or "Unsupported base model family"

    def to_dict(self, family: str) -> dict[str, object]:
        ok, reason = self.compat_reason(family)
        return {
            "id": self.id,
            "name": self.name,
            "filename": self.filename,
            "path": self.path,
            "kind": self.kind,
            "compatible": ok,
            "reason": reason,
        }


def resolve_lora_dir(override: str | None = None) -> Path:
    raw = (override or os.environ.get("QWEN_LORA_DIR", "")).strip()
    return Path(raw) if raw else lora_dir()


def _label_from_filename(filename: str) -> str:
    return Path(filename).stem.replace("_", " ").strip()


def _classify_file(path: Path) -> tuple[str, str | None]:
    try:
        with safe_open(path, framework="pt") as f:
            keys = list(f.keys())
            meta = f.metadata() or {}
    except Exception as exc:
        return "error", str(exc)

    if not keys:
        return "empty", "No tensors in file"

    sample = " ".join(keys[:40])
    if any(k.startswith(QWEN_LORA_PREFIX) for k in keys):
        return "qwen_lora", None

    arch = str(meta.get("modelspec.architecture", "")).lower()
    sd_model = str(meta.get("ss_sd_model_name", "")).lower()

    if arch.startswith("stable-diffusion-xl") or "lora_te1_text_model" in sample:
        return "sdxl_lora", None

    if "lora_te_text_model" in sample and "lora_te1_text_model" not in sample:
        return "sd15_lora", "SD 1.5 LoRA — needs an SD 1.5 base model"

    if "cond_stage_model" in sample or "conditioner.embedders" in sample:
        return "checkpoint", "Full model checkpoint — not a LoRA"

    if "model.diffusion_model.blocks" in sample and "lora_" not in sample:
        return "checkpoint", "Merged model weights — not a LoRA"

    if "stable-diffusion" in sd_model:
        return "sd_lora", "Stable Diffusion weights — not a LoRA adapter"

    return "unknown", "Unrecognized LoRA format"


def scan_loras(directory: Path | None = None) -> list[LoraEntry]:
    root = directory or resolve_lora_dir()
    if not root.is_dir():
        return []

    entries: list[LoraEntry] = []
    for path in sorted(root.rglob("*.safetensors")):
        kind, reason = _classify_file(path)
        entries.append(
            LoraEntry(
                id=path.stem,
                name=_label_from_filename(path.name),
                filename=path.name,
                path=str(path.resolve()),
                kind=kind,
                reason=reason,
            )
        )
    return entries


def get_lora(entry_id: str, directory: Path | None = None) -> LoraEntry | None:
    for entry in scan_loras(directory):
        if entry.id == entry_id:
            return entry
    return None
