import type { App } from "obsidian";

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export type ModelSlot = "llm" | "novel" | "summarize" | "tts" | "image";

export type SwitchStatus = "idle" | "loading" | "ready" | "error";

export interface SlotState {
	slot: ModelSlot;
	activeModelId: string;
	loadedModelId: string | null;
	status: SwitchStatus;
	error: string | null;
	serverRunning: boolean;
}

/** Runtime bridge to obsidian-cybria-core (types duplicated for compile-time only). */
export interface CybriaCoreApi {
	vaultPath(): string;
	repoRoot(): string;
	serverUrl(server: "llm" | "summarize" | "tts" | "image"): string;
	llm: {
		ping(baseUrl?: string): Promise<{ ready?: boolean; loading?: boolean; model_id?: string; error?: string | null }>;
		loadModel(modelId: string, baseUrl?: string): Promise<void>;
		downloadModel(modelId: string, baseUrl?: string): Promise<void>;
		streamChat(
			messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
			opts: {
				model?: string;
				temperature?: number;
				maxTokens?: number;
				systemPrompt?: string;
			},
			baseUrl?: string,
			signal?: AbortSignal
		): AsyncGenerator<string>;
		streamContinue(
			context: string,
			systemPrompt: string,
			modelId: string,
			baseUrl?: string,
			signal?: AbortSignal
		): AsyncGenerator<string>;
	};
	summarize: {
		ping(baseUrl?: string): Promise<{ ready?: boolean; error?: string }>;
		summarize(text: string, modelId: string, baseUrl?: string): Promise<string>;
		downloadModel(modelId: string, baseUrl?: string): Promise<void>;
		loadModel(modelId: string, baseUrl?: string): Promise<void>;
	};
	tts: {
		ping(baseUrl?: string): Promise<{ ready?: boolean; error?: string }>;
		synthesize(text: string, baseUrl?: string, speed?: number): Promise<ArrayBuffer>;
		downloadModel(baseUrl?: string): Promise<void>;
		loadModel(baseUrl?: string): Promise<void>;
	};
	image: {
		ping(baseUrl?: string): Promise<{ ready?: boolean; loading?: boolean; model_id?: string; error?: string | null }>;
		loadModel(modelId: string, baseUrl?: string): Promise<void>;
	};
	switcher: {
		getActiveModel(slot: ModelSlot): string;
		getState(slot: ModelSlot): SlotState;
		activate(
			slot: ModelSlot,
			modelId: string,
			opts?: { ensureServer?: boolean; onLog?: (line: string) => void }
		): Promise<void>;
		refresh(): Promise<void>;
		onChange(fn: (slot: ModelSlot, state: SlotState) => void): () => void;
		listModels(slot: ModelSlot): Array<{ id: string; name: string; runnable: string; note?: string }>;
		activeModelName(slot: ModelSlot): string;
	};
	runner(server: "llm" | "summarize" | "tts" | "image"): {
		resolveToolsDir(vaultBasePath: string, override?: string): string;
		isRunning(): boolean;
		launchServer(toolsDir: string, onLine: (line: string) => void): void;
		stopServer(onLine: (line: string) => void): void;
		installRequirements(toolsDir: string, onLine: (line: string) => void): Promise<void>;
		checkRequirements(
			toolsDir: string,
			onLine: (line: string) => void
		): Promise<{
			ok: boolean;
			errors: string[];
			model?: string;
			max_side?: number;
			packages?: Record<string, string>;
		}>;
		downloadModel(toolsDir: string, modelId: string, onLine: (line: string) => void): Promise<void>;
	};
	resolveToolsDir(server: "llm" | "summarize" | "tts" | "image", override?: string): string;
	modelPaths(): {
		root: string;
		loras: string;
		huggingface: string;
		llm: string;
		tts: string;
		summarization: string;
	};
}

const CORE_ID = "cybria-core";

export function requireCybriaCore(app: App): CybriaCoreApi {
	const plugins = (app as App & { plugins: { plugins: Record<string, { api?: CybriaCoreApi }> } })
		.plugins.plugins;
	const plugin = plugins[CORE_ID];
	if (!plugin?.api) {
		throw new Error("Enable Cybria Core before this plugin.");
	}
	return plugin.api;
}

export type ReqCheckResult = {
	ok: boolean;
	errors: string[];
	python?: string;
	executable?: string;
	model?: string;
	max_side?: number;
	packages?: Record<string, string>;
};
