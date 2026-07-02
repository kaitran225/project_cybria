import { existsSync, readdirSync, readFileSync } from "fs";
import * as path from "path";

export interface ModelPathsConfig {
	root: string;
	loras: string;
	huggingface: string;
	llm: string;
	tts: string;
	summarization: string;
}

const FALLBACK: ModelPathsConfig = {
	root: "G:\\.models",
	loras: "G:\\.models\\LoRa",
	huggingface: "G:\\.models\\Qwen",
	llm: "G:\\.models\\llm",
	tts: "G:\\.models\\tts",
	summarization: "G:\\.models\\summarization",
};

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

export function repoRootFromVault(vaultBasePath: string): string {
	return path.dirname(path.dirname(vaultBasePath));
}

export function repoRootFromTools(toolsDir: string): string {
	return path.dirname(path.dirname(toolsDir));
}

export function loadModelPathsFromRepo(repoRoot: string): ModelPathsConfig {
	const configPath = path.join(repoRoot, ".tools", "model-paths.json");
	try {
		if (existsSync(configPath)) {
			const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<ModelPathsConfig>;
			return {
				root: raw.root?.trim() || FALLBACK.root,
				loras: raw.loras?.trim() || FALLBACK.loras,
				huggingface: raw.huggingface?.trim() || FALLBACK.huggingface,
				llm: raw.llm?.trim() || FALLBACK.llm,
				tts: raw.tts?.trim() || FALLBACK.tts,
				summarization: raw.summarization?.trim() || FALLBACK.summarization,
			};
		}
	} catch {
		/* fallback */
	}
	return { ...FALLBACK };
}

export function loadModelPathsFromVault(vaultBasePath: string): ModelPathsConfig {
	return loadModelPathsFromRepo(repoRootFromVault(vaultBasePath));
}

export function loadModelPathsFromTools(toolsDir: string): ModelPathsConfig {
	return loadModelPathsFromRepo(repoRootFromTools(toolsDir));
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
