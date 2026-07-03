# Finding #8 — Stop gateway uses SIGTERM only, not `POST /shutdown`

## Summary

The Servers tab **Stop gateway** button calls `runner().stopServer()` (SIGTERM on the local child) but does not call `POST /shutdown`. The Obsidian exit path uses HTTP shutdown first. Behavior is inconsistent; child services may survive a panel stop.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/servers-panel.ts` | `stopGateway()` |
| `.vault/.../obsidian-cybria-core/src/api.ts` | `shutdownOnExit()` uses POST |
| `.tools/cybria-server/server.py` | `/shutdown` stops all services + exits |

## Problem in depth

`stopGateway()`:

```352:358:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\servers-panel.ts
	private stopGateway(): void {
		this.log("# stop cybria-server");
		this.plugin.api.runner().stopServer((l) => this.log(l));
		void this.refreshStatuses();
		...
	}
```

`stopServer` sends SIGTERM to the gateway process only. Whether children die depends on OS process group behavior. Gateway `lifespan` and signal handlers call `stop_all_services()`, but abrupt SIGTERM may not run cleanup reliably on all platforms.

`shutdownOnExit` uses cooperative `POST /shutdown` which explicitly runs `stop_all_services()` then delayed `os._exit(0)`.

## Impact

- Orphan `cybria-llm`, llama-server, or vllm after Stop gateway.
- Ports 22531–22534, 18790, 18792 left occupied.
- Next Start may trigger `_free_port` kills — [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md).

## Reproduction

1. Launch gateway, Start LLM (loaded).
2. Click **Stop gateway** (not Stop on LLM card).
3. Check Task Manager for surviving python/llama processes.

## Recommended fix

1. Extract `api.shutdownGateway()` that POSTs `/shutdown` when local proc or health OK, then `stopServer()`.
2. Use from `stopGateway()` and align with gated `shutdownOnExit` — [01-critical-shutdown-on-exit.md](01-critical-shutdown-on-exit.md).

## Effort

**S**

## Related findings

- [01-critical-shutdown-on-exit.md](01-critical-shutdown-on-exit.md)
- [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md)
- [31-low-unix-child-tree-kill.md](31-low-unix-child-tree-kill.md)
