"""GGUF chat model catalog for cybria-llm."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from model_paths import llm_dir


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    repo_id: str
    category: str
    recommended_quant: str
    size_gb: float
    runnable_local: str
    note: str = ""
    gguf_glob: str = "*.gguf"


MODELS: list[ModelSpec] = [
    ModelSpec(
        id="gemma-4-12b-agentic-gguf",
        name="Gemma 4 12B Agentic (GGUF)",
        repo_id="yuxinlu1/gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2-GGUF",
        category="llm",
        recommended_quant="Q4_K_M",
        size_gb=7.5,
        runnable_local="yes",
        note="Agentic coding / tool use.",
        gguf_glob="*Q4_K_M*.gguf",
    ),
    ModelSpec(
        id="ornith-1.0-9b",
        name="Ornith 1.0 9B",
        repo_id="deepreinforce-ai/Ornith-1.0-9B-GGUF",
        category="llm",
        recommended_quant="Q4_K_M",
        size_gb=7.0,
        runnable_local="yes",
        note="Agentic coding.",
        gguf_glob="*Q4_K_M*.gguf",
    ),
    ModelSpec(
        id="wanabi-novelist-12b",
        name="Wanabi Novelist 12B",
        repo_id="mradermacher/Wanabi-Novelist-12B-i1-GGUF",
        category="llm",
        recommended_quant="Q4_K_M",
        size_gb=7.6,
        runnable_local="yes",
        note="Japanese novel writing.",
        gguf_glob="*Q4_K_M*.gguf",
    ),
    ModelSpec(
        id="nqlsg-qwen3-14b-novel",
        name="NQLSG Qwen3 14B NovelFusion",
        repo_id="mradermacher/NQLSG-Qwen3-14B-NovelFusion-Base-i1-GGUF",
        category="llm",
        recommended_quant="Q4_K_M",
        size_gb=9.1,
        runnable_local="tight",
        note="14B novel model. Try Q3_K_M if OOM.",
        gguf_glob="*Q4_K_M*.gguf",
    ),
    ModelSpec(
        id="qwen2.5-3b-instruct",
        name="Qwen2.5 3B Instruct (light)",
        repo_id="bartowski/Qwen2.5-3B-Instruct-GGUF",
        category="llm",
        recommended_quant="Q4_K_M",
        size_gb=2.0,
        runnable_local="yes",
        note="Lightweight 4GB-VRAM chat test.",
        gguf_glob="*Q4_K_M*.gguf",
    ),
    ModelSpec(
        id="ministral-3-3b-novel",
        name="Ministral 3 3B (light novel)",
        repo_id="bartowski/mistralai_Ministral-3-3B-Instruct-2512-GGUF",
        category="llm",
        recommended_quant="Q4_K_M",
        size_gb=2.15,
        runnable_local="yes",
        note="Mistral 3B instruct — 4GB-VRAM novel test.",
        gguf_glob="*Q4_K_M*.gguf",
    ),
]

DEFAULT_MODEL_ID = "gemma-4-12b-agentic-gguf"


def get_model(model_id: str) -> ModelSpec:
    for m in MODELS:
        if m.id == model_id:
            return m
    raise KeyError(f"Unknown model: {model_id}")


def model_storage_dir(model_id: str) -> Path:
    return llm_dir() / model_id


def find_gguf(model_id: str) -> Path | None:
    d = model_storage_dir(model_id)
    if not d.is_dir():
        return None
    spec = get_model(model_id)
    matches = sorted(d.glob(spec.gguf_glob))
    if matches:
        return matches[0]
    all_gguf = sorted(d.glob("*.gguf"))
    return all_gguf[0] if all_gguf else None


def model_catalog() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in MODELS:
        gguf = find_gguf(m.id)
        out.append(
            {
                "id": m.id,
                "name": m.name,
                "repo_id": m.repo_id,
                "category": m.category,
                "recommended_quant": m.recommended_quant,
                "size_gb": m.size_gb,
                "runnable_local": m.runnable_local,
                "note": m.note,
                "installed": gguf is not None,
                "gguf_path": str(gguf) if gguf else None,
            }
        )
    return out
