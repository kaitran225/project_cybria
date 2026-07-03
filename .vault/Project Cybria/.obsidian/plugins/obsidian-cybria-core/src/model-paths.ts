import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import type { ModelPathsConfig } from "./settings";
import { EMPTY_MODEL_PATHS } from "./settings";

export type { ModelPathsConfig };
export { EMPTY_MODEL_PATHS };

export function derivedModelPaths(root: string): ModelPathsConfig {
	const base = root.replace(/[/\\]+$/, "");
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
	const root = input?.root?.trim() ?? "";
	const derived = root ? derivedModelPaths(root) : { ...EMPTY_MODEL_PATHS };
	return {
		root,
		loras: input?.loras?.trim() || derived.loras,
		huggingface: input?.huggingface?.trim() || derived.huggingface,
		llm: input?.llm?.trim() || derived.llm,
		tts: input?.tts?.trim() || derived.tts,
		summarization: input?.summarization?.trim() || derived.summarization,
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
		const resolved = resolveModelPaths(raw);
		return resolved.root ? resolved : null;
	} catch {
		return null;
	}
}

/** Write `.tools/model-paths.json` for Python / PowerShell start scripts. */
export function syncModelPathsFile(repoRoot: string, paths: ModelPathsConfig): void {
	if (!repoRoot.trim() || !paths.root.trim()) return;
	const configPath = modelPathsConfigPath(repoRoot);
	const dir = path.dirname(configPath);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(configPath, `${JSON.stringify(paths, null, 2)}\n`, "utf-8");
}

export function repoRootFromVault(vaultBasePath: string): string {
	return path.dirname(path.dirname(vaultBasePath));
}

export function repoRootFromTools(toolsDir: string): string {
	return path.dirname(path.dirname(toolsDir));
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
