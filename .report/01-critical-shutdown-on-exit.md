# Finding #1 — `shutdownOnExit` may kill remote/shared gateway

## Summary

On Obsidian unload, `shutdownOnExit()` sends `POST /shutdown` to the configured gateway URL before verifying that this Obsidian instance spawned that gateway. Pointing **Gateway URL** at a shared or remote server causes exit to shut down the gateway for all users.

## Severity

Critical

## Status

**Open** — verified in current `api.ts` (July 2026). The audit-recommended fix (gate on `isGatewayRunning()`) is **not** implemented.

## Affected files

| Path | Role |
|------|------|
| `.vault/Project Cybria/.obsidian/plugins/obsidian-cybria-core/src/api.ts` | `shutdownOnExit()` implementation |
| `.vault/Project Cybria/.obsidian/plugins/obsidian-cybria-core/src/main.ts` | Calls `shutdownOnExit` from `onunload` |
| `.tools/cybria-server/server.py` | `POST /shutdown` stops all services and exits gateway |

## Problem in depth

`CybriaCoreApi.shutdownOnExit()` is the cleanup hook when the Cybria Core plugin unloads (Obsidian close or plugin disable). It:

1. Always attempts `POST {baseUrl}/shutdown` with a 5s abort timeout.
2. Only afterward checks `isGatewayRunning()` to SIGTERM the locally tracked child process.

`isGatewayRunning()` returns true only when `CybriaServerRunner` still holds a reference to a process **this plugin instance** spawned via **Launch gateway**. If the user configured `baseUrl` to another host (e.g. `http://devbox:2253`) or attached to an already-running local gateway started outside Obsidian, step 1 still runs and tells that gateway to exit.

The gateway `/shutdown` handler calls `stop_all_services()` and `os._exit(0)`, terminating LLM, TTS, and image workloads for everyone using that host.

## Code evidence

```147:161:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\api.ts
	/** Stop gateway and all child services (call on Obsidian exit). */
	async shutdownOnExit(): Promise<void> {
		const base = this.baseUrl();
		try {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), 5000);
			await fetch(`${base}/shutdown`, { method: "POST", signal: ctrl.signal });
			clearTimeout(timer);
		} catch {
			/* gateway already down or unreachable */
		}
		if (this.isGatewayRunning()) {
			this.runner().stopServer(() => {});
		}
	}
```

```51:53:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\main.ts
	async onunload(): Promise<void> {
		await this.api.shutdownOnExit();
	}
```

```388:399:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
@app.post("/shutdown")
async def api_shutdown() -> dict[str, Any]:
    """Stop all services and exit the gateway (used when Obsidian closes)."""
    print("[cybria-server] shutdown requested", flush=True)
    stop_all_services()
    ...
```

### Session note: partial vs full fix

| Change | Status |
|--------|--------|
| `onunload` → `shutdownOnExit` + local `stopServer` | **Done** |
| Gate `POST /shutdown` on locally launched gateway only | **Not done** — still **Open** |

## Impact

- **Multi-user / shared dev server:** One researcher closing Obsidian kills the team gateway.
- **Remote URL in settings:** Unintended production-like outage.
- **Local external gateway:** User who started `cybria-server` manually loses work on Obsidian exit even though Obsidian did not own the process (HTTP shutdown still fires).

## Reproduction

1. Start `cybria-server` on machine A (or use an existing shared instance).
2. On machine B (or same machine), set Cybria Core **Gateway URL** to that instance.
3. Do **not** click Launch gateway (no local `isGatewayRunning()`).
4. Use services through the remote URL.
5. Close Obsidian on machine B.
6. Observe gateway on machine A receives shutdown and exits.

## Recommended fix

1. In `shutdownOnExit()`, call `POST /shutdown` **only when** `this.isGatewayRunning()` is true.
2. If not locally running but `fetchGatewayHealth()` succeeds, skip shutdown (user attached to external gateway).
3. Optionally: if local proc exists but health is on different URL, log a warning and still only shutdown when URLs match.
4. Document in settings that remote gateways are never stopped by Obsidian exit.

```typescript
async shutdownOnExit(): Promise<void> {
  if (!this.isGatewayRunning()) return;
  const base = this.baseUrl();
  try {
    await fetch(`${base}/shutdown`, { method: "POST", signal: AbortSignal.timeout(5000) });
  } catch { /* already down */ }
  this.runner().stopServer(() => {});
}
```

Align **Stop gateway** button with same semantics — [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md).

## Effort

**S** — single function reorder + small test matrix.

## Related findings

- [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md)
- [00-session-validation.md](00-session-validation.md) — exit cleanup test case 3.5
- [00-good-shape.md](00-good-shape.md) — partial exit cleanup improvements
