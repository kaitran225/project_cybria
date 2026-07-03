# Finding #23 — No project README

## Summary

The repository has no root `README.md`. Onboarding depends on reading plugin code, `.tools/` layout, and JSON catalogs.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| Repository root | Missing `README.md` |
| `.tools/run.sh`, `cybria_cli` | Undocumented entry points for new contributors |
| `.report/README.md` | Audit index only (this documentation pass) |

## Problem in depth

New users must discover:

- Vault location vs repo root
- Cybria Core plugin in Obsidian
- Gateway port 2253 and `cybria_cli` commands
- Model path configuration

No single setup guide exists.

## Impact

- Slower onboarding.
- Repeated questions about ports and install order.

## Recommended fix

Add short root `README.md`:

1. What Project Cybria is
2. Open vault path
3. Build plugins (`build-plugins.py`)
4. Install gateway + services
5. Link to `.report/00-port-map.md` and `.report/README.md`

## Effort

**S**

## Related findings

- [27-low-dual-obsidian-trees.md](27-low-dual-obsidian-trees.md)
