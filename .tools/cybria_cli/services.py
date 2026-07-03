"""Registered Cybria tool services."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from cybria_cli.runner import TOOLS_ROOT


@dataclass(frozen=True)
class ServiceSpec:
    id: str
    folder: str
    extra_env: dict[str, str] = field(default_factory=dict)
    cuda_torch_on_setup: bool = False
    setup_message: str | None = None

    @property
    def dir(self) -> Path:
        return TOOLS_ROOT / self.folder


SERVICES: dict[str, ServiceSpec] = {
    "gateway": ServiceSpec(
        id="gateway",
        folder="cybria-server",
        extra_env={"CYBRIA_PORT": "2253"},
        setup_message="Unified gateway on http://127.0.0.1:2253",
    ),
    "cybria-server": ServiceSpec(
        id="cybria-server",
        folder="cybria-server",
        extra_env={"CYBRIA_PORT": "2253"},
    ),
    "llm": ServiceSpec(id="llm", folder="cybria-llm"),
    "cybria-llm": ServiceSpec(id="cybria-llm", folder="cybria-llm"),
    "summarize": ServiceSpec(id="summarize", folder="cybria-summarize"),
    "cybria-summarize": ServiceSpec(id="cybria-summarize", folder="cybria-summarize"),
    "tts": ServiceSpec(id="tts", folder="cybria-tts"),
    "cybria-tts": ServiceSpec(id="tts", folder="cybria-tts"),
    "image": ServiceSpec(
        id="image",
        folder="cybria-diffuser",
        cuda_torch_on_setup=True,
        extra_env={
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
            "QWEN_IMAGE_MAX_SIDE": "1024",
            "QWEN_IMAGE_LIGHTNING_WEIGHT": (
                "Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors"
            ),
        },
        setup_message="Diffusion (Qwen + SDXL) on http://127.0.0.1:8789",
    ),
    "diffuser": ServiceSpec(
        id="diffuser",
        folder="cybria-diffuser",
        cuda_torch_on_setup=True,
        extra_env={
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
            "QWEN_IMAGE_MAX_SIDE": "1024",
            "QWEN_IMAGE_LIGHTNING_WEIGHT": (
                "Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors"
            ),
        },
    ),
    "cybria-diffuser": ServiceSpec(
        id="cybria-diffuser",
        folder="cybria-diffuser",
        cuda_torch_on_setup=True,
        extra_env={
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
            "QWEN_IMAGE_MAX_SIDE": "1024",
            "QWEN_IMAGE_LIGHTNING_WEIGHT": (
                "Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors"
            ),
        },
    ),
}


def resolve(name: str) -> ServiceSpec:
    key = name.strip().lower()
    if key not in SERVICES:
        known = ", ".join(sorted({s.folder for s in SERVICES.values()}))
        raise KeyError(f"Unknown service '{name}'. Known folders: {known}")
    return SERVICES[key]


def list_services() -> list[ServiceSpec]:
    seen: set[str] = set()
    out: list[ServiceSpec] = []
    for spec in SERVICES.values():
        if spec.folder in seen:
            continue
        seen.add(spec.folder)
        out.append(spec)
    return sorted(out, key=lambda s: s.folder)
