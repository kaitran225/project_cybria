# Finding #6 — External gateway: switcher shows offline

## Summary

`ModelSwitcher.refresh()` only calls `fetchGatewayHealth()` when `isGatewayRunning()` is true (local child process tracked). If the gateway URL points to an external instance, refresh clears all slots to idle/offline even when the remote gateway is healthy.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/model-switcher.ts` | `refresh()` |
| `.vault/.../obsidian-cybria-core/src/servers-panel.ts` | `refreshStatuses()` always fetches health (contrast) |

## Problem in depth

`isGatewayRunning()` is true only when this Obsidian session spawned the gateway via `CybriaServerRunner`. Users who set `baseUrl` to a shared server or started gateway manually never set `this.proc` in the runner.

`refresh()` sets `health = null` when `!localProc`, then patches every slot to `status: "idle"` and `serverRunning: gatewayUp` where `gatewayUp = localProc || health` — so with external gateway, `gatewayUp` is false.

Ironically, `servers-panel.refreshStatuses()` **always** calls `fetchGatewayHealth()` and paints cards correctly for external gateways. Dashboard and model switcher state diverge.

## Code evidence

```173:191:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\model-switcher.ts
	async refresh(): Promise<void> {
		const localProc = this.api.isGatewayRunning();
		const health = localProc ? await this.api.fetchGatewayHealth() : null;
		const gatewayUp = !!(localProc || health);

		for (const slot of this.listSlots()) {
			...
			if (!health) {
				this.patch(slot, { status: "idle", loadedModelId: null, error: null });
				continue;
			}
```

```156:162:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\servers-panel.ts
	async refreshStatuses(): Promise<void> {
		const localProc = this.plugin.api.isGatewayRunning();
		...
		const health = await this.plugin.api.fetchGatewayHealth();
```

## Impact

- Home dashboard and Apps show models offline despite working remote gateway.
- `activate()` with `ensureServer: false` still works if user knows to Start — confusing UX.
- External gateway workflow discouraged despite architectural support.

## Reproduction

1. Start gateway outside Obsidian on :2253.
2. Set Cybria Core URL to `http://127.0.0.1:2253` (do not Launch).
3. Start LLM via curl or another client.
4. Open Cybria AI → Refresh — switcher slots idle; Servers tab may show ready.

## Recommended fix

Always fetch health in `refresh()`:

```typescript
const health = await this.api.fetchGatewayHealth();
const gatewayUp = !!(this.api.isGatewayRunning() || health);
```

Use `serverRunning: gatewayUp` and apply health snapshot when `health` is non-null.

## Effort

**S**

## Related findings

- [01-critical-shutdown-on-exit.md](01-critical-shutdown-on-exit.md)
- [30-low-no-periodic-refresh.md](30-low-no-periodic-refresh.md)
