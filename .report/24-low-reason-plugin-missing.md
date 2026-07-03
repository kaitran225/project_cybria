# Finding #24 — `reason` plugin enabled but missing

## Summary

`community-plugins.json` lists `reason` as enabled, but no `plugins/reason/` folder exists in the vault.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/Project Cybria/.obsidian/community-plugins.json` | Enables `reason` |
| `.vault/Project Cybria/.obsidian/plugins/` | No `reason` directory |

## Problem in depth

Obsidian will attempt to load the plugin on startup and show a load error for missing `main.js`. Clutters startup and plugin list.

## Code evidence

```1:14:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\community-plugins.json
[
  "dataview",
  ...
  "reason",
  ...
]
```

Glob search for `plugins/reason/**` returns zero files.

## Impact

- Obsidian error notification each launch.
- Implies broken vault config.

## Recommended fix

Remove `"reason"` from `community-plugins.json` or install/restore the plugin.

## Effort

**S**

## Related findings

- [25-low-web-view-incomplete.md](25-low-web-view-incomplete.md)
