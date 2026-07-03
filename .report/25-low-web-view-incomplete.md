# Finding #25 — `web-view` plugin incomplete

## Summary

`web-view` is enabled in `community-plugins.json` but the plugin folder contains only `manifest.json` and `styles.css` — no `main.js` or built output.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/Project Cybria/.obsidian/community-plugins.json` | Enables `web-view` |
| `.vault/Project Cybria/.obsidian/plugins/web-view/` | Incomplete install |

## Problem in depth

```1:9:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\web-view\manifest.json
{
	"id": "web-view",
	"name": "Web View",
	...
}
```

No `main.js` present — Obsidian cannot load the plugin.

## Impact

- Startup plugin error.
- Feature advertised in manifest unavailable.

## Recommended fix

1. Build/install complete web-view plugin from source, or
2. Disable in `community-plugins.json` until built.

## Effort

**S**

## Related findings

- [24-low-reason-plugin-missing.md](24-low-reason-plugin-missing.md)
