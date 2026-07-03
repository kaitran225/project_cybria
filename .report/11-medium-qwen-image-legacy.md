# Finding #11 — Legacy `qwen-image/` folder

## Summary

`.tools/qwen-image/` remains in the repo with stub server code and duplicated modules, though production path is `cybria-diffuser`. It confuses contributors and tooling.

## Severity

Medium

## Status

**Open** — `server.py` is a deprecation stub; folder not removed.

## Affected files

| Path | Role |
|------|------|
| `.tools/qwen-image/server.py` | Exits with redirect message |
| `.tools/qwen-image/models.py`, `loras.py`, `check_env.py`, `model_paths.py` | Duplicated logic |
| `.tools/cybria-diffuser/` | Current implementation |

## Problem in depth

`qwen-image/server.py` explicitly states replacement by `cybria-diffuser` and exits code 1. Other files in the folder mirror diffuser concerns (models, env check, paths). CLI and gateway reference `cybria-diffuser` only; `qwen-image` is dead weight and risks drift if edited by mistake.

## Code evidence

```1:16:c:\Users\kaitr\.vault\project_cybria\.tools\qwen-image\server.py
"""Deprecated — use .tools/cybria-diffuser/server.py instead."""
...
    print(
        "qwen-image/server.py was replaced by cybria-diffuser.\n"
        "Run: cd .tools && python -m cybria_cli run cybria-diffuser\n"
        ...
    )
    raise SystemExit(1)
```

## Impact

- Onboarding confusion ("which image server?").
- Duplicate `model_paths.py` wrapper — [14-medium-duplicate-model-paths.md](14-medium-duplicate-model-paths.md).
- Stale `QWEN_IMAGE_*` naming — [12-medium-qwen-image-env-rename.md](12-medium-qwen-image-env-rename.md).

## Reproduction

List `.tools/qwen-image/` — multiple active-looking Python files despite stub entrypoint.

## Recommended fix

1. Delete `.tools/qwen-image/` or move to `archive/qwen-image/` with README pointer.
2. Grep repo for imports of `qwen-image` and remove.
3. Update any docs referencing old path.

## Effort

**S**

## Related findings

- [12-medium-qwen-image-env-rename.md](12-medium-qwen-image-env-rename.md)
- [14-medium-duplicate-model-paths.md](14-medium-duplicate-model-paths.md)
