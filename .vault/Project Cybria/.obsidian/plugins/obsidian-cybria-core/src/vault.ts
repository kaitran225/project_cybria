import * as path from "path";
import type { App } from "obsidian";

export function vaultBasePath(app: App): string {
	return (app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? "";
}

export function repoRootFromApp(app: App): string {
	const base = vaultBasePath(app);
	if (!base) return "";
	return path.dirname(path.dirname(base));
}
