# Finding #22 — Service process stays up after model load fails

## Summary

`servers-panel.startService()` calls gateway `startService` (spawns Python child), then `ModelSwitcher.activate()` for model load. If model load fails, the service process remains running in idle/partial state.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/servers-panel.ts` | `startService()` |
| `.tools/cybria-server/server.py` | No auto-stop on downstream load failure |

## Problem in depth

Flow in `startService`:

1. `api.startService(service)` → gateway spawns e.g. `cybria-llm` on 22531, returns `ok: true` when health HTTP succeeds.
2. `switcher.activate(slot, modelId)` → `POST /models/load`.
3. On activate exception, catch logs error and Notice — **does not** call `stopService(service)`.

GPU memory may be partially allocated; process holds port until manual Stop.

## Code evidence

```283:316:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\servers-panel.ts
	private async startService(service: CybriaServiceKey): Promise<void> {
		...
			const res = await this.plugin.api.startService(service);
			if (!res.ok) { ... return; }
			...
			await this.plugin.api.switcher.activate(slot, modelId, { ... });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			...
		} finally {
			await this.refreshStatuses();
```

## Impact

- Zombie service consuming VRAM after failed load.
- User must manually Stop before retry.

## Recommended fix

1. In `catch` of `startService`, `await this.api.stopService(service)` when activate fails.
2. Or gateway tracks "start session" and rolls back child on failed load webhook.
3. Document in UI: "Load failed — service stopped."

## Effort

**S**

## Related findings

- [02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md)
- [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md)
