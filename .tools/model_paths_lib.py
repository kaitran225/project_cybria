"""Shared model path resolution — reads .tools/model-paths.json (synced from Cybria Core settings)."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

_CONFIG_PATH = Path(__file__).resolve().parent / "model-paths.json"
_KEYS = ("root", "loras", "huggingface", "llm", "tts", "summarization")
_ENV_VAR_PATTERN = re.compile(r"%([^%]+)%|\$\{([^}]+)\}")


def default_model_root() -> Path:
    return Path.home() / ".models"


def expand_path(raw: str) -> str:
    s = raw.strip()
    if not s:
        return ""

    if s == "~":
        return str(Path.home())
    if s.startswith("~/") or s.startswith("~\\"):
        return str(Path.home() / s[2:])

    def _repl(match: re.Match[str]) -> str:
        name = match.group(1) or match.group(2)
        return os.environ.get(name, match.group(0))

    return str(Path(_ENV_VAR_PATTERN.sub(_repl, s)))


def _derive_from_root(root: str) -> dict[str, str]:
    base = Path(expand_path(root))
    return {
        "root": str(base),
        "loras": str(base / "LoRa"),
        "huggingface": str(base / "Qwen"),
        "llm": str(base / "llm"),
        "tts": str(base / "tts"),
        "summarization": str(base / "summarization"),
    }


def _is_reachable(p: Path) -> bool:
    try:
        if p.is_dir():
            return True
        anchor = p.anchor
        if anchor and not Path(anchor).exists():
            return False
        p.mkdir(parents=True, exist_ok=True)
        return True
    except OSError:
        return False


def _effective_root(raw_root: str) -> str:
    expanded = expand_path(raw_root)
    if expanded and _is_reachable(Path(expanded)):
        return expanded
    return str(default_model_root())


def load_model_paths() -> dict[str, str]:
    paths: dict[str, str] = {k: "" for k in _KEYS}
    if not _CONFIG_PATH.is_file():
        return _derive_from_root(str(default_model_root()))

    try:
        with _CONFIG_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return _derive_from_root(str(default_model_root()))
    if not isinstance(data, dict):
        return _derive_from_root(str(default_model_root()))

    root = _effective_root(str(data.get("root", "")))
    paths = _derive_from_root(root)
    for key in _KEYS:
        raw = data.get(key)
        if isinstance(raw, str) and raw.strip():
            expanded = expand_path(raw)
            if key == "root" or _is_reachable(Path(expanded)):
                paths[key] = expanded
    return paths


def _hub_cache_dir(hf_path: Path) -> Path:
    if any(hf_path.glob("models--*")):
        return hf_path
    hub = hf_path / "hub"
    if hub.is_dir() and any(hub.glob("models--*")):
        return hub
    return hub


def hub_cache_dir(hf_path: str | Path) -> Path:
    return _hub_cache_dir(Path(hf_path))


def get_path(key: str, env_var: str | None = None) -> Path:
    if env_var:
        raw = os.environ.get(env_var, "").strip()
        if raw:
            return Path(expand_path(raw))
    value = load_model_paths().get(key, "").strip()
    if not value:
        raise RuntimeError(
            f"Model path '{key}' is not configured. Set model storage in Cybria Core settings."
        )
    return Path(value)


def ensure_model_dirs() -> None:
    paths = load_model_paths()
    for p in paths.values():
        if p.strip():
            Path(p).mkdir(parents=True, exist_ok=True)
    hf = paths.get("huggingface", "").strip()
    if hf:
        hub_cache_dir(hf).mkdir(parents=True, exist_ok=True)


def model_path_env() -> dict[str, str]:
    paths = load_model_paths()
    root = paths.get("root", "").strip()
    if not root:
        return {}
    hub = hub_cache_dir(paths["huggingface"] or str(Path(root) / "Qwen"))
    return {
        "CYBRIA_MODEL_ROOT": root,
        "CYBRIA_LLM_DIR": paths.get("llm", ""),
        "CYBRIA_SUMMARIZE_DIR": paths.get("summarization", ""),
        "CYBRIA_TTS_DIR": paths.get("tts", ""),
        "QWEN_LORA_DIR": paths.get("loras", ""),
        "HF_HOME": root,
        "HUGGINGFACE_HUB_CACHE": str(hub),
        "TRANSFORMERS_CACHE": str(hub),
        "DIFFUSERS_CACHE": str(hub),
    }


def apply_huggingface_env() -> Path:
    """Point Hugging Face / diffusers downloads at the configured cache."""
    root = get_path("root")
    hf_home = get_path("huggingface")
    hub = hub_cache_dir(hf_home)
    hf_home.mkdir(parents=True, exist_ok=True)
    hub.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(root))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(hub))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(hub))
    os.environ.setdefault("DIFFUSERS_CACHE", str(hub))
    return hub
