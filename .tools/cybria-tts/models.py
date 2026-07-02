"""TTS model catalog for cybria-tts."""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_MODEL_ID = "moss-tts-nano"
DEFAULT_VOICE = "Ava"


@dataclass(frozen=True)
class TtsModelSpec:
    id: str
    name: str
    repo_id: str
    size_gb: float
    runnable_local: str
    default_voice: str
    note: str = ""


MODELS: list[TtsModelSpec] = [
    TtsModelSpec(
        id="moss-tts-nano",
        name="MOSS-TTS-Nano",
        repo_id="OpenMOSS-Team/MOSS-TTS-Nano",
        size_gb=0.4,
        runnable_local="yes",
        default_voice="Ava",
        note="0.1B — 4GB-VRAM / CPU friendly",
    ),
    TtsModelSpec(
        id="higgs-tts-3-4b",
        name="Higgs TTS 3 4B",
        repo_id="bosonai/higgs-tts-3-4b",
        size_gb=5.0,
        runnable_local="tight",
        default_voice="default",
        note="Heavy — needs 6GB+ VRAM",
    ),
]


def get_model(model_id: str | None = None) -> TtsModelSpec:
    mid = (model_id or DEFAULT_MODEL_ID).strip()
    for m in MODELS:
        if m.id == mid:
            return m
    raise KeyError(f"Unknown TTS model: {mid}")


def storage_dir_name(model_id: str) -> str:
    return get_model(model_id).id
