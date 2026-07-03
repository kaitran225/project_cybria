# Finding #27 — Dual `.obsidian/` trees

## Summary

The git repo contains both a minimal `.obsidian/` at the repository root and the full vault configuration under `.vault/Project Cybria/.obsidian/`. It is unclear which Obsidian should open.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Contents |
|------|----------|
| `c:\Users\kaitr\.vault\project_cybria\.obsidian\` | `app.json`, `appearance.json`, `core-plugins.json` only |
| `.vault/Project Cybria/.obsidian/` | Full plugins, themes, community-plugins |

## Problem in depth

Cybria Core and all plugins live under the vault path. Root `.obsidian` looks like a stray or alternate vault pointer. `repoRootFromApp` derives `.tools` from vault parent — opening wrong folder breaks tools path resolution.

## Impact

- Contributors open repo root as vault → Cybria plugins missing.
- Documentation ambiguity.

## Recommended fix

1. Document canonical vault: `.vault/Project Cybria`.
2. Remove root `.obsidian` if accidental, or add README pointer.
3. `project-cybria.code-workspace` should recommend correct vault folder.

## Effort

**S**

## Related findings

- [23-low-no-readme.md](23-low-no-readme.md)
- [00-architecture.md](00-architecture.md)
