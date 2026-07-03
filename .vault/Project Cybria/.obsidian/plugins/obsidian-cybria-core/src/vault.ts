import * as path from "path";
import type { App } from "obsidian";

export function vaultBasePath(app: App): string {
	return (app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? "";
}

/** Repo root: parent of `.vault` (vault lives at `.vault/<name>/`). */
export function repoRootFromVault(vaultBasePath: string): string {
	if (!vaultBasePath) return "";
	return path.dirname(path.dirname(vaultBasePath));
}

export function repoRootFromTools(toolsDir: string): string {
	return path.dirname(path.dirname(toolsDir));
}

export function repoRootFromApp(app: App): string {
	return repoRootFromVault(vaultBasePath(app));
}
