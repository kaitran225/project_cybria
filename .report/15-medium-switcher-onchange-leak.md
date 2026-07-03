# Finding #15 — ModelSwitcher `onChange` listener leak

## Summary

`ModelSwitcherView.onOpen()` registers `this.plugin.api.switcher.onChange(...)` but `onClose()` does not call the returned unsubscribe function. Reopening the view accumulates duplicate listeners.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.vault/.../obsidian-cybria-core/src/ModelSwitcherView.ts` | `onOpen` / `onClose` |
| `.vault/.../obsidian-cybria-core/src/model-switcher.ts` | `onChange` returns unsubscribe |

## Problem in depth

`ModelSwitcher.onChange` correctly returns `() => this.listeners.delete(fn)`. `ModelSwitcherView` stores no reference and `onClose` only unmounts terminal and apps host:

```169:172:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\ModelSwitcherView.ts
	async onClose(): Promise<void> {
		this.terminalPanel?.unmount();
		this.appsHost?.unmount();
	}
```

Registration at line 160–165 fires on every slot patch → duplicate dashboard renders and service select syncs after pane close/reopen cycles.

## Code evidence

```58:61:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\model-switcher.ts
	onChange(fn: SwitcherListener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
```

## Impact

- Performance degradation on long Obsidian sessions.
- Duplicate UI updates / subtle state bugs.

## Reproduction

1. Open Cybria AI pane, close leaf, reopen multiple times.
2. Trigger model switch — observe multiple dashboard refreshes per event.

## Recommended fix

```typescript
private unsubSwitcher: (() => void) | null = null;

// onOpen:
this.unsubSwitcher = this.plugin.api.switcher.onChange(() => { ... });

// onClose:
this.unsubSwitcher?.();
this.unsubSwitcher = null;
```

## Effort

**S**

## Related findings

- [30-low-no-periodic-refresh.md](30-low-no-periodic-refresh.md)
