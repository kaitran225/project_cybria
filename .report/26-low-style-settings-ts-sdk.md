# Finding #26 — Style Settings installed but not enabled; TS SDK points at it

## Summary

`obsidian-style-settings` exists under `plugins/` and is built by `build-plugins.py`, but it is not in `community-plugins.json`. The workspace TypeScript SDK still references its `node_modules/typescript`.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/Project Cybria/.obsidian/plugins/obsidian-style-settings/` | Installed source |
| `.vault/Project Cybria/.obsidian/community-plugins.json` | Does not list style-settings |
| `project-cybria.code-workspace` | `typescript.tsdk` → style-settings node_modules |

## Problem in depth

```12:12:c:\Users\kaitr\.vault\project_cybria\project-cybria.code-workspace
    "typescript.tsdk": ".vault/Project Cybria/.obsidian/plugins/obsidian-style-settings/node_modules/typescript/lib",
```

Cybria plugin development depends on another plugin's npm install. If style-settings is removed or not `npm install`ed, IDE TypeScript breaks.

Plugin is optional for Cybria UX but kept in build script line 45 of `build-plugins.py`.

## Impact

- Confusing dev environment setup.
- Orphan dependency for TS version pinning.

## Recommended fix

1. Point `typescript.tsdk` at `obsidian-cybria-core/node_modules/typescript` or repo-pinned version.
2. Remove from `build-plugins.py` if unused, or enable in community-plugins if desired.

## Effort

**S**

## Related findings

- [23-low-no-readme.md](23-low-no-readme.md)
