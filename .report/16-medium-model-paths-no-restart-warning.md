# Finding #16 — Model path changes need gateway restart (no warning)

## Summary

Changing model storage paths in Cybria Core settings updates `.tools/model-paths.json` on save, but running gateway and service processes keep their original environment until restarted. The UI does not warn users.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/main.ts` | `saveSettings` → `syncModelPathsFile` |
| `.vault/.../obsidian-cybria-core/src/settings-tab.ts` | Path text fields |
| `.vault/.../obsidian-cybria-core/src/server-runner.ts` | `serverEnv()` captured at process spawn |

## Problem in depth

`modelPathEnv` is applied when Python processes start (`launchServer`, gateway `start_service` child env). Live processes continue reading old `HF_HOME`, `CYBRIA_LLM_DIR`, etc.

`saveSettings` syncs JSON for **future** spawns but does not restart gateway or call `stopService` on children.

User may change root to a new drive, see correct path in settings, but downloads still go to old cache until manual Stop/Start.

## Code evidence

```84:87:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\main.ts
	async saveSettings(): Promise<void> {
		this.settings.modelPaths = sanitizeModelPaths(this.settings.modelPaths);
		syncModelPathsFile(repoRootFromApp(this.app), this.settings.modelPaths);
		await this.saveData(this.settings);
```

```128:134:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\server-runner.ts
	private serverEnv(toolsDir: string): NodeJS.ProcessEnv {
		this.ensureModelDirs(toolsDir);
		const paths = this.resolveModelPaths(toolsDir);
		...
		return { ...process.env, ...pathEnv, ...extra, ...this.runtimeEnv() };
	}
```

## Impact

- Models "not found" after path change despite correct settings display.
- Split caches on disk.

## Recommended fix

1. On model path save, if gateway running → Notice: "Restart gateway and services for path change."
2. Optional: offer "Restart now" button stopping all services.
3. Compare path mtime/hash in gateway health.

## Effort

**S**

## Related findings

- [17-medium-sanitize-paths-ui-drift.md](17-medium-sanitize-paths-ui-drift.md)
