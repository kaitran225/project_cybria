# Finding #3 — LLM first load can exceed timeouts

## Summary

First GPU load of a GGUF model can take many minutes, but the Obsidian model switcher polls for only 300 seconds while the inner llama launcher allows 600 seconds. The gateway service-start wait is 120 seconds.

## Severity

High

## Status

**Open** — inner 600s timeout is implemented; outer layers remain shorter.

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-llm/server_launcher.py` | `READY_TIMEOUT` default 600s |
| `.vault/.../obsidian-cybria-core/src/model-switcher.ts` | `pollLoaded()` default 300s |
| `.tools/cybria-server/server.py` | `_wait_for_service` 120s on start |

## Problem in depth

Layered timeouts:

| Layer | Timeout | What it waits for |
|-------|---------|-------------------|
| Gateway `api_start_service` | 120s | HTTP `/health` &lt; 500 |
| `LlamaServerProcess.wait_ready` | 600s (env) | Inner `/v1/models` 200 |
| `ModelSwitcher.pollLoaded` | 300s (900s image) | Service `/health` `ready` + model_id |

A slow first CUDA load can succeed inside `server_launcher` (up to 600s) while the UI `pollLoaded` aborts at 300s with "Timed out waiting for model to load" even though llama is still starting.

Gateway may report start OK at 120s while model load continues for minutes ([02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md)).

## Code evidence

```23:23:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-llm\server_launcher.py
READY_TIMEOUT = float(os.environ.get("CYBRIA_LLM_READY_TIMEOUT", "600"))
```

```130:171:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\model-switcher.ts
	private async pollLoaded(
		slot: ModelSlot,
		service: CybriaServiceKey,
		modelId: string,
		timeoutMs = 300_000
	): Promise<void> {
		const url = this.api.serviceUrl(service);
		const deadline = Date.now() + (service === "image" ? 900_000 : timeoutMs);
		...
		throw new Error("Timed out waiting for model to load");
	}
```

```375:375:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
    ok = await _wait_for_service(name, timeout=120.0)
```

## Impact

- False failure notices on Qwen 3B / large quant first load.
- User may retry Start, spawning duplicate load attempts.
- Session validation item "LLM load with Qwen 3B" may fail in UI while server eventually succeeds.

## Reproduction

1. Fresh GPU machine, large GGUF, cold cache.
2. Servers → Start LLM with model.
3. Observe terminal: llama still loading after 5 minutes.
4. UI shows timeout error around 5 minutes (`pollLoaded`).

## Recommended fix

1. Align `pollLoaded` LLM timeout with `CYBRIA_LLM_READY_TIMEOUT` (600s default) or make configurable in settings.
2. Surface `loading: true` from health as in-progress, not error.
3. Extend gateway start wait when health returns `loading: true`.
4. Document expected first-load duration in UI hint.

## Effort

**S** — constant alignment + optional settings knob.

## Related findings

- [02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md)
- [30-low-no-periodic-refresh.md](30-low-no-periodic-refresh.md)
- [00-session-validation.md](00-session-validation.md)
