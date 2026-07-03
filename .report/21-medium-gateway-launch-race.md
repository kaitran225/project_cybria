# Finding #21 — No gateway launch/stop mutex

## Summary

Double-clicking **Launch gateway** or rapid Launch/Stop can spawn overlapping `ensureGatewayRunning` calls or race `launchServer` against `stopServer` without serialization.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/gateway.ts` | `ensureGatewayRunning` |
| `.vault/.../obsidian-cybria-core/src/servers-panel.ts` | `launchGateway`, `stopGateway` |

## Problem in depth

`CybriaServerRunner.launchServer` guards with `if (this.proc) return` but two concurrent `ensureGatewayRunning` calls can both pass `isGatewayRunning()` false before either sets `this.proc`.

`stopGateway` is synchronous SIGTERM while launch is async — user can stop during poll loop and leave inconsistent state.

No debounce on Launch button (`onclick = () => void this.launchGateway()`).

## Impact

- Duplicate gateway processes fighting for port 2253 (second fails obscurely).
- Orphan gateway if stop kills wrong proc reference.

## Recommended fix

1. Module-level `gatewayMutex: Promise<void> | null` chaining ensure/stop.
2. Disable Launch/Stop buttons while operation in flight.
3. `launchServer` return Promise when process listening.

## Effort

**S**

## Related findings

- [07-high-launch-server-silent-venv-miss.md](07-high-launch-server-silent-venv-miss.md)
- [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md)
