import type { App } from "obsidian";
import { ImageClient } from "./clients/image";
import { LlmClient } from "./clients/llm";
import { SummarizeClient } from "./clients/summarize";
import { TtsClient } from "./clients/tts";
import type { ModelSlot } from "./catalog";
import { apiBase } from "./http";
import {
	loadModelPathsFromVault,
	type ModelPathsConfig,
} from "./model-paths";
import { ModelSwitcher } from "./model-switcher";
import { SemanticSummarizer } from "./semantic-summarize";
import {
	CybriaServerRunner,
	GATEWAY_ENV,
	type ServerEnvExtra,
} from "./server-runner";
import { ServerLog } from "./server-log";
import type { CybriaCoreSettings } from "./settings";
import {
	CYBRIA_BASE_URL,
	CYBRIA_CORE_ID,
	CYBRIA_PORT,
	GATEWAY_TOOLS,
	SERVICE_PATHS,
	SERVICE_TOOLS,
	type CybriaServiceKey,
	type CybriaServerKey,
} from "./servers";
import { repoRootFromApp, vaultBasePath } from "./vault";

export type { ChatMessage, ChatOptions, LlmHealth } from "./clients/llm";
export type { CatalogModel, ModelSlot } from "./catalog";
export type { ModelPathsConfig } from "./model-paths";
export type { CybriaServiceKey, CybriaServerKey } from "./servers";
export type { CybriaServerRunner, ReqCheckResult, ServerEnvExtra } from "./server-runner";
export type { SlotState, SwitchStatus } from "./model-switcher";
export type {
	SemanticSummarizeOptions,
	SemanticSummarizeResult,
} from "./semantic-summarize";
export type { CatalyzeHit, CatalyzeResponse } from "./enzyme/catalyze";
export { CYBRIA_BASE_URL, CYBRIA_CORE_ID, CYBRIA_PORT, GATEWAY_TOOLS } from "./servers";
export { SLOT_LABELS, MODEL_CATALOG } from "./catalog";

export type SaveActiveModelFn = (slot: ModelSlot, modelId: string) => Promise<void>;
export type GetActiveModelsFn = () => Record<ModelSlot, string>;
export type GetCoreSettingsFn = () => CybriaCoreSettings;

export class CybriaCoreApi {
	readonly llm: LlmClient;
	readonly summarize: SummarizeClient;
	readonly tts: TtsClient;
	readonly image: ImageClient;
	readonly switcher: ModelSwitcher;
	readonly semantic: SemanticSummarizer;
	readonly log: ServerLog;

	private gatewayRunner: CybriaServerRunner | null = null;
	private readonly serviceRunners = new Map<string, CybriaServerRunner>();

	constructor(
		private readonly app: App,
		private readonly getSettings: GetCoreSettingsFn,
		getActiveModels: GetActiveModelsFn,
		saveActiveModel: SaveActiveModelFn
	) {
		this.log = new ServerLog();
		const llm = this.serviceUrl("llm");
		this.llm = new LlmClient(llm);
		this.summarize = new SummarizeClient(this.serviceUrl("summarize"));
		this.tts = new TtsClient(this.serviceUrl("tts"));
		this.image = new ImageClient(this.serviceUrl("image"));
		this.switcher = new ModelSwitcher(this, getActiveModels, saveActiveModel);
		this.semantic = new SemanticSummarizer(this);
	}

	baseUrl(): string {
		return apiBase(this.getSettings().baseUrl?.trim() || CYBRIA_BASE_URL);
	}

	/** Service API base, e.g. http://127.0.0.1:2253/llm */
	serviceUrl(service: CybriaServiceKey): string {
		return `${this.baseUrl()}${SERVICE_PATHS[service]}`;
	}

	/** @deprecated Use serviceUrl(service) */
	serverUrl(service: CybriaServiceKey): string {
		return this.serviceUrl(service);
	}

	appendLog(line: string): void {
		this.log.append(line);
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

	resolveToolsDir(target: CybriaServerKey, override = ""): string {
		const subdir = target === "gateway" ? GATEWAY_TOOLS : SERVICE_TOOLS[target];
		const pathOverride =
			override || (target === "gateway" ? this.getSettings().toolsPath.trim() : "");
		return this.serviceRunner(subdir).resolveToolsDir(this.vaultPath(), pathOverride);
	}

	/** Gateway process (single port 2253). */
	runner(): CybriaServerRunner {
		if (!this.gatewayRunner) {
			this.gatewayRunner = new CybriaServerRunner(GATEWAY_TOOLS, GATEWAY_ENV);
		}
		return this.gatewayRunner;
	}

	isGatewayRunning(): boolean {
		return this.runner().isRunning();
	}

	async stopService(service: CybriaServiceKey): Promise<void> {
		try {
			await fetch(`${this.baseUrl()}/services/${service}/stop`, { method: "POST" });
		} catch {
			/* gateway offline */
		}
	}

	/** Runner for per-service venv install/download (not the gateway process). */
	serviceRunner(toolsSubdir: string, extraEnv?: ServerEnvExtra): CybriaServerRunner {
		let r = this.serviceRunners.get(toolsSubdir);
		if (!r) {
			r = new CybriaServerRunner(toolsSubdir, extraEnv);
			this.serviceRunners.set(toolsSubdir, r);
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
