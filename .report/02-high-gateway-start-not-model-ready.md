# Finding #2 — Gateway start OK ≠ model ready

## Summary

`POST /services/{name}/start` returns `ok: true` when the child service responds to `/health` with any HTTP status below 500, without requiring `ready: true` in the JSON body. The LLM can report HTTP 200 with `ready: false` while still loading.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-server/server.py` | `_wait_for_service()`, `api_start_service()` |
| `.tools/cybria-llm/server.py` | `/health` returns `ready: false` during load |
| `.vault/.../obsidian-cybria-core/src/servers-panel.ts` | Treats `startService` ok as "process healthy" |

## Problem in depth

After spawning a service subprocess, the gateway polls `GET http://127.0.0.1:{internal_port}/health` until timeout (120s). Success condition is only `r.status_code < 500`. It does not parse the response JSON for `ready`, `loading`, or `error`.

For `cybria-llm`, `/health` returns 200 immediately when the FastAPI process is up, but `ready` is false while `_loading` is true or before llama-server starts:

```53:64:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-llm\server.py
@app.get("/health")
def health() -> dict[str, Any]:
    st = _llama.status()
    ready = st["running"] and not _loading
    return {
        "ready": ready,
        "loading": _loading,
        ...
    }
```

The servers panel then logs "process healthy" and proceeds to `ModelSwitcher.activate()` for model load — which may be correct eventually, but any consumer assuming `ok: true` means inference-ready will misbehave.

Summarize always returns `ready: true` without a loaded model ([20-medium-summarize-health-always-ready.md](20-medium-summarize-health-always-ready.md)), compounding false positives.

### Session note: LLM inner readiness

`server_launcher.wait_ready()` correctly uses `/v1/models` for **llama-server** readiness — **fixed** for model load path. This finding remains about **gateway service start** wait semantics, not inner llama probe.

## Code evidence

```307:322:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
async def _wait_for_service(name: str, timeout: float = 120.0) -> bool:
    ...
        try:
            r = await _client.get(url, timeout=3.0)
            if r.status_code < 500:
                return True
        except Exception:
            pass
```

```366:377:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
@app.post("/services/{name}/start")
async def api_start_service(name: str) -> dict[str, Any]:
    ...
    ok = await _wait_for_service(name, timeout=120.0)
    err = None if ok else f"{name} did not become healthy in 120s ..."
    return {"ok": ok, "service": name, "error": err}
```

## Impact

- Misleading "started" state in UI before service can serve requests.
- Race: `activate()` may hit 503 on `/models/load` if called before uvicorn is fully bound.
- Automated tooling using gateway start API assumes stronger guarantees than provided.

## Reproduction

1. Patch or observe LLM `/health` returning 200 with `ready: false` (default on fresh start).
2. `POST /services/llm/start` → `{"ok": true}` within seconds.
3. Gateway aggregate `/health` may still show `ready: false` for llm.

## Recommended fix

1. Extend `_wait_for_service` to parse JSON when `Content-Type` is JSON.
2. For `llm`, `image`, `tts`: require `ready: true` OR accept `loading: true` with extended wait for model services.
3. Return structured `{"ok": false, "phase": "process_up", "ready": false}` when process responds but not ready.
4. Optionally increase timeout for LLM/image when `loading: true`.

## Effort

**M**

## Related findings

- [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md)
- [20-medium-summarize-health-always-ready.md](20-medium-summarize-health-always-ready.md)
- [22-medium-start-service-partial-failure.md](22-medium-start-service-partial-failure.md)
- [00-good-shape.md](00-good-shape.md) — inner `/v1/models` fix
