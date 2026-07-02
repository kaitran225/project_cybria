import type { App } from "obsidian";
import { ImageClient } from "./clients/image";
import { LlmClient } from "./clients/llm";
import { SummarizeClient } from "./clients/summarize";
import { TtsClient } from "./clients/tts";
import type { ModelSlot } from "./catalog";
import {
	loadModelPathsFromVault,
	type ModelPathsConfig,
} from "./model-paths";
import { ModelSwitcher } from "./model-switcher";
import { SemanticSummarizer } from "./semantic-summarize";
import {
	CybriaServerRunner,
	QWEN_IMAGE_ENV,
	type ServerEnvExtra,
} from "./server-runner";
import { CYBRIA_CORE_ID, CYBRIA_SERVERS, type CybriaServerKey } from "./servers";
import { repoRootFromApp, vaultBasePath } from "./vault";

export type { ChatMessage, ChatOptions, LlmHealth } from "./clients/llm";
export type { CatalogModel, ModelSlot } from "./catalog";
export type { ModelPathsConfig } from "./model-paths";
export type { CybriaServerKey } from "./servers";
export type { CybriaServerRunner, ReqCheckResult, ServerEnvExtra } from "./server-runner";
export type { SlotState, SwitchStatus } from "./model-switcher";
export type {
	SemanticSummarizeOptions,
	SemanticSummarizeResult,
} from "./semantic-summarize";
export type { CatalyzeHit, CatalyzeResponse } from "./enzyme/catalyze";
export { CYBRIA_CORE_ID, CYBRIA_SERVERS } from "./servers";
export { SLOT_LABELS, MODEL_CATALOG } from "./catalog";

export type SaveActiveModelFn = (slot: ModelSlot, modelId: string) => Promise<void>;
export type GetActiveModelsFn = () => Record<ModelSlot, string>;

export class CybriaCoreApi {
	readonly llm: LlmClient;
	readonly summarize: SummarizeClient;
	readonly tts: TtsClient;
	readonly image: ImageClient;
	readonly switcher: ModelSwitcher;
	readonly semantic: SemanticSummarizer;

	private readonly runners = new Map<string, CybriaServerRunner>();

	constructor(
		private readonly app: App,
		getActiveModels: GetActiveModelsFn,
		saveActiveModel: SaveActiveModelFn
	) {
		this.llm = new LlmClient(CYBRIA_SERVERS.llm.defaultUrl);
		this.summarize = new SummarizeClient(CYBRIA_SERVERS.summarize.defaultUrl);
		this.tts = new TtsClient(CYBRIA_SERVERS.tts.defaultUrl);
		this.image = new ImageClient(CYBRIA_SERVERS.image.defaultUrl);
		this.switcher = new ModelSwitcher(this, getActiveModels, saveActiveModel);
		this.semantic = new SemanticSummarizer(this);
	}

	vaultPath(): string {
		return vaultBasePath(this.app);
	}

	repoRoot(): string {
		return repoRootFromApp(this.app);
	}

	modelPaths(): ModelPathsConfig {
		return loadModelPathsFromVault(this.vaultPath());
	}

	resolveToolsDir(server: CybriaServerKey, override = ""): string {
		return this.runner(server).resolveToolsDir(this.vaultPath(), override);
	}

	runner(server: CybriaServerKey): CybriaServerRunner {
		const spec = CYBRIA_SERVERS[server];
		let r = this.runners.get(spec.toolsSubdir);
		if (!r) {
			const extra = server === "image" ? QWEN_IMAGE_ENV : undefined;
			r = new CybriaServerRunner(spec.toolsSubdir, extra);
			this.runners.set(spec.toolsSubdir, r);
		}
		return r;
	}

	serverRunner(toolsSubdir: string, extraEnv?: ServerEnvExtra): CybriaServerRunner {
		let r = this.runners.get(toolsSubdir);
		if (!r) {
			r = new CybriaServerRunner(toolsSubdir, extraEnv);
			this.runners.set(toolsSubdir, r);
		}
		return r;
	}
}

export function requireCybriaCore(app: App): CybriaCoreApi {
	const plugin = (app as App & { plugins: { plugins: Record<string, { api?: CybriaCoreApi }> } }).plugins
		.plugins[CYBRIA_CORE_ID];
	if (!plugin?.api) {
		throw new Error("Cybria Core plugin must be enabled before other Cybria plugins.");
	}
	return plugin.api;
}
