# Finding #29 — CLI TTS ServiceSpec `id` typo

## Summary

In `cybria_cli/services.py`, the `cybria-tts` service entry uses `id="tts"` instead of `id="cybria-tts"`, inconsistent with other canonical ids like `cybria-llm`.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria_cli/services.py` | `SERVICES` registry |

## Problem in depth

```40:41:c:\Users\kaitr\.vault\project_cybria\.tools\cybria_cli\services.py
    "tts": ServiceSpec(id="tts", folder="cybria-tts"),
    "cybria-tts": ServiceSpec(id="tts", folder="cybria-tts"),
```

Both keys resolve to the same spec with `id="tts"`. `list_services()` dedupes by folder so behavior works, but programmatic consumers using `spec.id` get wrong identifier.

## Impact

- Minor inconsistency in CLI output/scripts.
- Confusion when matching gateway service names (`tts` vs `cybria-tts`).

## Recommended fix

Change to `id="cybria-tts"` for the canonical entry; keep `"tts"` alias key if needed.

## Effort

**S**

## Related findings

- None
