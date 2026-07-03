# Finding #14 — Duplicate `model_paths.py` wrappers

## Summary

Five nearly identical thin wrappers import `model_paths_lib` from per-service `model_paths.py` files instead of importing the shared library directly.

## Severity

Medium

## Status

**Open**

## Affected files

| Path |
|------|
| `.tools/cybria-llm/model_paths.py` |
| `.tools/cybria-summarize/model_paths.py` |
| `.tools/cybria-tts/model_paths.py` |
| `.tools/cybria-diffuser/common/model_paths.py` |
| `.tools/qwen-image/model_paths.py` (legacy) |

Shared implementation: `.tools/model_paths_lib.py`

## Problem in depth

Each wrapper adds `sys.path` hack and re-exports `ensure_model_dirs`, `get_path`, etc. with service-specific helpers (`llm_dir()`, `tts_dir()`, …). Changes to path resolution require touching multiple files or only `model_paths_lib` — wrappers add maintenance surface without distinct logic.

Example (`cybria-llm`):

```1:18:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-llm\model_paths.py
"""Load global model storage paths from .tools/model-paths.json."""
...
from model_paths_lib import ensure_model_dirs, get_path, load_model_paths, model_path_env

def llm_dir() -> Path:
    return get_path("llm", "CYBRIA_LLM_DIR")
```

## Impact

- Copy-paste drift risk.
- Harder refactors of path schema.

## Recommended fix

1. Single package import: `from model_paths_lib import llm_dir` with aliases defined once in lib.
2. Or namespace package under `.tools/cybria_paths/`.
3. Remove `qwen-image` copy with folder delete — [11-medium-qwen-image-legacy.md](11-medium-qwen-image-legacy.md).

## Effort

**M**

## Related findings

- [11-medium-qwen-image-legacy.md](11-medium-qwen-image-legacy.md)
- [00-good-shape.md](00-good-shape.md) — sync design is sound
