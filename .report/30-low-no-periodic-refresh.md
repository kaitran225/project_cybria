# Finding #30 — No periodic servers-tab refresh during long loads

## Summary

During multi-minute model loads, the Servers tab and status header only update when the user clicks **Refresh status** or when an operation's `finally` block runs. No timer polls gateway health while waiting.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/ModelSwitcherView.ts` | Manual `refreshSwitcher` |
| `.vault/.../obsidian-cybria-core/src/servers-panel.ts` | `refreshStatuses` on demand |

## Problem in depth

`startService` sets loading state locally but during `pollLoaded` (up to 300–900s) the pulsing dot relies on prior paint until `finally` calls `refreshStatuses`.

`ModelSwitcher` emits patch events during `activate`, but server card health comes from gateway snapshot — not re-fetched until end.

## Impact

- Stale "starting" or ambiguous UI during long GPU load.
- User uncertainty whether process hung — [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md).

## Recommended fix

1. While `loadingSlot !== null`, interval `setInterval` every 3–5s calling `refreshStatuses` + partial switcher refresh.
2. Clear interval in `finally` / `onClose`.

## Effort

**S**

## Related findings

- [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md)
- [15-medium-switcher-onchange-leak.md](15-medium-switcher-onchange-leak.md)
