/**
 * Fork of obsidian-enzyme VaultSearch — local semantic retrieval via `enzyme catalyze`.
 * Query is fully local (SQLite + on-device embeddings). Index build is separate (enzyme init).
 */

import { execFile as nodeExecFile } from "child_process";
import { existsSync } from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(nodeExecFile);

export interface CatalyzeHit {
	file_path: string;
	relativePath: string;
	content: string;
	similarity: number;
}

export interface CatalyzeCatalyst {
	text?: string;
	entity?: string;
}

export interface CatalyzeResponse {
	query: string;
	results: CatalyzeHit[];
	top_contributing_catalysts: CatalyzeCatalyst[];
}

export function enzymeDbPath(vaultPath: string): string {
	return path.join(vaultPath, ".enzyme", "enzyme.db");
}

export function isEnzymeIndexed(vaultPath: string): boolean {
	return existsSync(enzymeDbPath(vaultPath));
}

export function getEnzymeCommand(): string {
	const home = os.homedir();
	const candidates = [
		path.join(home, ".cargo", "bin", "enzyme.exe"),
		path.join(home, ".cargo", "bin", "enzyme"),
		path.join(home, ".local", "bin", "enzyme.exe"),
		path.join(home, ".local", "bin", "enzyme"),
		"C:\\Program Files\\enzyme\\enzyme.exe",
		"/opt/homebrew/bin/enzyme",
		"/usr/local/bin/enzyme",
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return "enzyme";
}

export async function enzymeAvailable(): Promise<boolean> {
	try {
		await execFileAsync(getEnzymeCommand(), ["--version"], { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

function normalizeVaultPath(p: string): string {
	return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

function toRelativePath(filePath: string, vaultPath: string): string {
	const norm = normalizeVaultPath(filePath);
	const base = normalizeVaultPath(vaultPath);
	if (norm.startsWith(base + "/")) return norm.slice(base.length + 1);
	return norm;
}

function parseCatalyzeStdout(stdout: string, vaultPath: string, query: string): CatalyzeResponse {
	const response = JSON.parse(stdout) as {
		results?: Array<{ file_path: string; content: string; similarity: number }>;
		top_contributing_catalysts?: CatalyzeCatalyst[];
	};
	const results = (response.results ?? []).map((r) => ({
		file_path: r.file_path,
		relativePath: toRelativePath(r.file_path, vaultPath),
		content: r.content.trim(),
		similarity: r.similarity,
	}));
	return {
		query,
		results,
		top_contributing_catalysts: response.top_contributing_catalysts ?? [],
	};
}

/** Run `enzyme catalyze` — local semantic vault search (Enzyme CLI). */
export async function catalyze(
	vaultPath: string,
	query: string,
	limit = 5,
	timeoutMs = 30_000
): Promise<CatalyzeResponse> {
	if (!isEnzymeIndexed(vaultPath)) {
		throw new Error(
			"Vault not indexed for semantic search. Run `enzyme init -p <vault>` in a terminal."
		);
	}
	const cmd = getEnzymeCommand();
	const args = ["catalyze", query, "-n", String(limit), "-p", vaultPath];
	try {
		const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: timeoutMs });
		if (stderr?.trim()) {
			console.warn(`[enzyme catalyze] ${stderr.trim()}`);
		}
		return parseCatalyzeStdout(stdout, vaultPath, query);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (/not initialized/i.test(msg)) {
			throw new Error("Vault not indexed. Run `enzyme init` first.");
		}
		throw new Error(`Semantic search failed: ${msg}`);
	}
}

export function formatHitsForDisplay(hits: CatalyzeHit[]): string {
	if (hits.length === 0) return "No matching notes found.";
	return hits
		.map((h) => {
			const link = h.relativePath.replace(/\.md$/i, "");
			const pct = (h.similarity * 100).toFixed(0);
			return `[[${link}]] (${pct}%)\n${h.content}`;
		})
		.join("\n\n---\n\n");
}

export function combineHitsForSummarize(hits: CatalyzeHit[], maxChars = 4000): string {
	const parts: string[] = [];
	let total = 0;
	for (const h of hits) {
		const block = `## ${h.relativePath}\n${h.content}`;
		if (total + block.length > maxChars) break;
		parts.push(block);
		total += block.length;
	}
	return parts.join("\n\n");
}
