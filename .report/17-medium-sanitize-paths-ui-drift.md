# Finding #17 — Sanitized paths vs settings UI display

## Summary

`sanitizeModelPaths()` silently replaces unreachable roots (e.g. old `G:\.models`) with the portable default, but the settings UI can still display the stale stored path until load/save cycles align.

## Severity

Medium

## Status

**Open** (partial mitigation on `loadSettings`)

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/model-paths.ts` | `sanitizeModelPaths`, `isModelRootReachable` |
| `.vault/.../obsidian-cybria-core/src/settings-tab.ts` | Binds inputs to `settings.modelPaths` |
| `.vault/.../obsidian-cybria-core/src/api.ts` | `modelPaths()` always returns sanitized |

## Problem in depth

Runtime API uses sanitized paths:

```85:87:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\api.ts
	modelPaths(): ModelPathsConfig {
		return sanitizeModelPaths(this.getSettings().modelPaths);
	}
```

`loadSettings` assigns sanitized paths back to `this.settings.modelPaths` on plugin load. However:

- Settings tab text fields read/write `this.plugin.settings.modelPaths[field.key]` directly.
- User can type unreachable path; until `saveSettings`, UI shows typed value while `api.modelPaths()` already fell back.
- If user never saves after failed path, `data.json` may retain bad root though JSON sync on prior save used sanitized value.

```47:54:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\model-paths.ts
export function sanitizeModelPaths(input: Partial<ModelPathsConfig> | undefined): ModelPathsConfig {
	const resolved = resolveModelPaths(input);
	if (!resolved.root.trim() || !isModelRootReachable(resolved.root)) {
		return derivedModelPaths(defaultPortableModelRoot());
	}
	return resolved;
}
```

## Impact

- User believes models go to `G:\.models` but files land in `%USERPROFILE%\.models`.
- Support confusion without explicit notice.

## Recommended fix

1. When sanitize changes root, set Notice: "Model root unreachable; using %USERPROFILE%\\.models".
2. Settings tab: display `api.modelPaths()` resolved values after save.
3. Validate on blur with inline error before save.

## Effort

**S**

## Related findings

- [16-medium-model-paths-no-restart-warning.md](16-medium-model-paths-no-restart-warning.md)
- [00-good-shape.md](00-good-shape.md)
