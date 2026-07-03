# Finding #18 — Satellite migration not persisted on first load

## Summary

`migrateSatelliteSettings()` sets `migratedFromSatellites = true` in memory after importing legacy plugin `data.json` files, but `loadSettings()` does not call `saveData()` afterward. Reinstall or second machine repeats migration logic until something triggers `saveSettings`.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/migrate-settings.ts` | Sets flag, merges satellite data |
| `.vault/.../obsidian-cybria-core/src/main.ts` | `loadSettings` without persist |

## Problem in depth

```70:105:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\migrate-settings.ts
	if (current.migratedFromSatellites) return merged;
	...
	merged.migratedFromSatellites = true;
	return merged;
```

`main.ts` `loadSettings`:

```72:81:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\main.ts
		this.settings = await migrateSatelliteSettings(this.app, partial);
		...
		this.settings.modelPaths = sanitizeModelPaths(this.settings.modelPaths);
		syncModelPathsFile(repoRootFromApp(this.app), this.settings.modelPaths);
```

No `await this.saveData(this.settings)` — flag and merged fields exist only in RAM until user changes any setting.

## Impact

- Repeated reads of deprecated plugin data on every cold start until save.
- Theoretical overwrite if satellite plugins still enabled and user data changes.

## Recommended fix

After first migration in `loadSettings`:

```typescript
const before = partial.migratedFromSatellites;
this.settings = await migrateSatelliteSettings(...);
if (!before && this.settings.migratedFromSatellites) {
  await this.saveData(this.settings);
}
```

## Effort

**S**

## Related findings

- None critical
