# Finding #7 — `launchServer()` silent return when venv missing

## Summary

If the gateway venv Python binary does not exist, `launchServer()` logs two lines and returns without throwing. `ensureGatewayRunning()` then polls `/health` for 30 seconds and fails with a generic timeout.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/server-runner.ts` | `launchServer()` |
| `.vault/.../obsidian-cybria-core/src/gateway.ts` | `ensureGatewayRunning()` 30s poll |

## Problem in depth

`launchServer` checks `existsSync(py)` and on failure:

```typescript
onLine(`[gateway] python not found: ${py}`);
onLine(`[gateway] run "Install deps" to create the venv first`);
return;
```

No exception, `this.proc` stays null. Caller `ensureGatewayRunning` loops until `timeoutMs` (default 30_000) then throws `gateway did not come up within 30s — check logs`.

User sees a timeout rather than immediate "run Install deps" in a Notice.

Contrast: `ensureVenv` and `installRequirements` throw on failure.

## Code evidence

```316:326:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\server-runner.ts
	launchServer(toolsDir: string, onLine: (line: string) => void): void {
		...
		const py = this.pythonExe(toolsDir);
		if (!existsSync(py)) {
			onLine(`[gateway] python not found: ${py}`);
			onLine(`[gateway] run "Install deps" to create the venv first`);
			return;
		}
```

```37:45:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\gateway.ts
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 1000));
		if (await api.fetchGatewayHealth()) {
			...
		}
	}
	throw new Error(`gateway did not come up within ${Math.round(timeoutMs / 1000)}s — check logs`);
```

## Impact

- 30s wasted wait on every launch attempt without venv.
- Support burden: logs must be opened to see real cause.

## Reproduction

1. Delete `.tools/cybria-server/.venv`.
2. Click Launch gateway without Install deps.
3. Wait → Notice "did not come up within 30s".

## Recommended fix

1. `launchServer` throws `new Error('Python not found — run Install deps')` when venv missing.
2. Or return `{ launched: false, reason: string }` and fail fast in `ensureGatewayRunning`.
3. Surface same message in `Notice` from `launchGateway()`.

## Effort

**S**

## Related findings

- [21-medium-gateway-launch-race.md](21-medium-gateway-launch-race.md)
