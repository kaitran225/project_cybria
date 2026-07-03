# Finding #20 — Summarize `/health` always `ready: true`

## Summary

`cybria-summarize` reports `ready: true` from `/health` even before any model is loaded into memory. Gateway and UI may show summarize as ready when the first request would still trigger a multi-second load.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-summarize/server.py` | `health()` |

## Problem in depth

Models load lazily in `_load_pipeline()` on first `/summarize` or `/models/load`. Health endpoint does not reflect cache state:

```71:78:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-summarize\server.py
@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ready": True,
        "model_id": _active_model,
        "device": _device(),
        "error": _load_error,
    }
```

`_active_model` defaults to catalog default without verifying `_cache` contains weights.

Combines with gateway `_wait_for_service` weak check — [02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md).

## Impact

- Switcher shows ready before first summarize completes.
- First user action hits long latency spike labeled as "ready" service.

## Recommended fix

```python
ready = _active_model in _cache and _load_error is None
```

Or `ready: bool` false until successful `load_model` or first pipeline load.

## Effort

**S**

## Related findings

- [02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md)
- [22-medium-start-service-partial-failure.md](22-medium-start-service-partial-failure.md)
