import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import * as os from "os";
import * as path from "path";
import type { ModelPathsConfig } from "./settings";
import { EMPTY_MODEL_PATHS } from "./settings";
import { repoRootFromVault, repoRootFromTools } from "./vault";

export type { ModelPathsConfig };
export { EMPTY_MODEL_PATHS };
export { repoRootFromVault, repoRootFromTools };

const SUBPATH_KEYS = ["loras", "huggingface", "llm", "tts", "summarization"] as const;

/** Portable default when no root is configured. */
export function defaultModelRoot(): string {
	return path.join(os.homedir(), ".models");
}

/** Default stored in settings / model-paths.json (portable across machines). */
export function defaultPortableModelRoot(): string {
	return process.platform === "win32" ? "%USERPROFILE%\\.models" : "~/.models";
}

/** True when the expanded path exists or can be created (drive present on Windows). */
export function isModelRootReachable(raw: string): boolean {
	const expanded = expandModelPath(raw);
	if (!expanded) return false;
	try {
		if (existsSync(expanded)) return true;
		const root = path.parse(expanded).root;
		if (root && !existsSync(root)) return false;
		mkdirSync(expanded, { recursive: true });
		return true;
	} catch {
		return false;
	}
}

/** Prefer `%USERPROFILE%\\.models` / `~/.models` when that is the resolved path. */
export function portableModelRoot(expandedRoot: string): string {
	const normalized = path.normalize(expandModelPath(expandedRoot));
	const homeModels = path.normalize(defaultModelRoot());
	if (normalized === homeModels) return defaultPortableModelRoot();
	return normalized;
}

/** Drop unreachable roots (e.g. old `G:\\.models`) and fall back to the portable default. */
export function sanitizeModelPaths(input: Partial<ModelPathsConfig> | undefined): ModelPathsConfig {
	const resolved = resolveModelPaths(input);
	if (!resolved.root.trim() || !isModelRootReachable(resolved.root)) {
		return derivedModelPaths(defaultPortableModelRoot());
	}
	return resolved;
}

/** Expand `~`, `%VAR%`, and `${VAR}` in a path string. */
export function expandModelPath(raw: string): string {
	let s = raw.trim();
	if (!s) return "";

	if (s === "~") return os.homedir();
	if (s.startsWith("~/") || s.startsWith("~\\")) {
		return path.normalize(path.join(os.homedir(), s.slice(2)));
	}

	s = s.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? `%${name}%`);
	s = s.replace(/\$\{([^}]+)\}/g, (_, name: string) => process.env[name] ?? `\${${name}}`);

	return path.normalize(s);
}

export function expandModelPaths(input: ModelPathsConfig): ModelPathsConfig {
	return {
		root: expandModelPath(input.root),
		loras: expandModelPath(input.loras),
		huggingface: expandModelPath(input.huggingface),
		llm: expandModelPath(input.llm),
		tts: expandModelPath(input.tts),
		summarization: expandModelPath(input.summarization),
	};
}

export function derivedModelPaths(root: string): ModelPathsConfig {
	const base = expandModelPath(root).replace(/[/\\]+$/, "");
	return {
		root: base,
		loras: path.join(base, "LoRa"),
		huggingface: path.join(base, "Qwen"),
		llm: path.join(base, "llm"),
		tts: path.join(base, "tts"),
		summarization: path.join(base, "summarization"),
	};
}

/** Merge stored settings with derived subpaths when only root is set. */
export function resolveModelPaths(input: Partial<ModelPathsConfig> | undefined): ModelPathsConfig {
	const root = expandModelPath(input?.root?.trim() ?? "");
	const derived = root ? derivedModelPaths(root) : { ...EMPTY_MODEL_PATHS };
	return {
		root,
		loras: expandModelPath(input?.loras?.trim() ?? "") || derived.loras,
		huggingface: expandModelPath(input?.huggingface?.trim() ?? "") || derived.huggingface,
		llm: expandModelPath(input?.llm?.trim() ?? "") || derived.llm,
		tts: expandModelPath(input?.tts?.trim() ?? "") || derived.tts,
		summarization: expandModelPath(input?.summarization?.trim() ?? "") || derived.summarization,
	};
}

export function hubCacheDir(hfPath: string): string {
	try {
		if (existsSync(hfPath)) {
			const entries = readdirSync(hfPath);
			if (entries.some((e) => e.startsWith("models--"))) return hfPath;
		}
	} catch {
		/* use hub subfolder */
	}
	return path.join(hfPath, "hub");
}

export function modelPathsConfigPath(repoRoot: string): string {
	return path.join(repoRoot, ".tools", "model-paths.json");
}

/** Read `.tools/model-paths.json` if present (bootstrap / migration). */
export function readModelPathsFile(repoRoot: string): ModelPathsConfig | null {
	const configPath = modelPathsConfigPath(repoRoot);
	try {
		if (!existsSync(configPath)) return null;
		const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<ModelPathsConfig>;
		const resolved = sanitizeModelPaths(raw);
		return resolved.root ? resolved : null;
	} catch {
		return null;
	}
}

/** Write `.tools/model-paths.json` for Python services (minimal, portable root). */
export function syncModelPathsFile(repoRoot: string, paths: ModelPathsConfig): void {
	const resolved = sanitizeModelPaths(paths);
	if (!repoRoot.trim() || !resolved.root.trim()) return;
	const derived = derivedModelPaths(resolved.root);
	const payload: Partial<ModelPathsConfig> = {
		root: portableModelRoot(resolved.root),
	};
	for (const key of SUBPATH_KEYS) {
		if (resolved[key] !== derived[key]) {
			payload[key] = resolved[key];
		}
	}
	const configPath = modelPathsConfigPath(repoRoot);
	const dir = path.dirname(configPath);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(configPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export function modelPathEnv(paths: ModelPathsConfig): NodeJS.ProcessEnv {
	const hub = hubCacheDir(paths.huggingface);
	return {
		CYBRIA_MODEL_ROOT: paths.root,
		CYBRIA_LLM_DIR: paths.llm,
		CYBRIA_SUMMARIZE_DIR: paths.summarization,
		CYBRIA_TTS_DIR: paths.tts,
		QWEN_LORA_DIR: paths.loras,
		HF_HOME: paths.root,
		HUGGINGFACE_HUB_CACHE: hub,
		TRANSFORMERS_CACHE: hub,
		DIFFUSERS_CACHE: hub,
		PYTHONUNBUFFERED: "1",
	};
}
