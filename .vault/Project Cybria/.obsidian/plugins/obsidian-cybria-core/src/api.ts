import type { App } from "obsidian";
import { ImageClient } from "./clients/image";
import { LlmClient } from "./clients/llm";
import { SummarizeClient } from "./clients/summarize";
import { TtsClient } from "./clients/tts";
import type { ModelSlot } from "./catalog";
import { apiBase } from "./http";
import { resolveModelPaths, sanitizeModelPaths, type ModelPathsConfig } from "./model-paths";
import { ModelSwitcher } from "./model-switcher";
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
import { ensureGatewayRunning, type EnsureGatewayOptions } from "./gateway";
import { repoRootFromApp, vaultBasePath } from "./vault";

export type SaveActiveModelFn = (slot: ModelSlot, modelId: string) => Promise<void>;
export type GetActiveModelsFn = () => Record<ModelSlot, string>;
export type GetCoreSettingsFn = () => CybriaCoreSettings;

export class CybriaCoreApi {
	readonly llm: LlmClient;
	readonly summarize: SummarizeClient;
	readonly tts: TtsClient;
	readonly image: ImageClient;
	readonly switcher: ModelSwitcher;
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
	}

	baseUrl(): string {
		return apiBase(this.getSettings().baseUrl?.trim() || CYBRIA_BASE_URL);
	}

	hardwareProfileId(): string {
		return this.getSettings().hardwareProfile;
	}

	/** Service API base, e.g. http://127.0.0.1:2253/llm */
	serviceUrl(service: CybriaServiceKey): string {
		return `${this.baseUrl()}${SERVICE_PATHS[service]}`;
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
		return sanitizeModelPaths(this.getSettings().modelPaths);
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
			this.gatewayRunner = new CybriaServerRunner(GATEWAY_TOOLS, GATEWAY_ENV, () =>
				this.modelPaths()
			);
		}
		return this.gatewayRunner;
	}

	isGatewayRunning(): boolean {
		return this.runner().isRunning();
	}

	async fetchGatewayHealth(): Promise<{
		ready: boolean;
		port: number;
		services: Record<string, Record<string, unknown>>;
	} | null> {
		try {
			const res = await fetch(`${this.baseUrl()}/health`);
			if (!res.ok) return null;
			return (await res.json()) as {
				ready: boolean;
				port: number;
				services: Record<string, Record<string, unknown>>;
			};
		} catch {
			return null;
		}
	}

	async startService(service: CybriaServiceKey): Promise<{ ok: boolean; error?: string }> {
		try {
			const res = await fetch(`${this.baseUrl()}/services/${service}/start`, { method: "POST" });
			const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
			if (!res.ok) return { ok: false, error: body.error ?? body.detail ?? `HTTP ${res.status}` };
			return { ok: !!body.ok, error: body.error };
		} catch (e) {
			return { ok: false, error: e instanceof Error ? e.message : String(e) };
		}
	}

	async stopService(service: CybriaServiceKey): Promise<void> {
		try {
			await fetch(`${this.baseUrl()}/services/${service}/stop`, { method: "POST" });
		} catch {
			/* gateway offline */
		}
	}

	/** Stop gateway and all child services (call on Obsidian exit). */
	async shutdownOnExit(): Promise<void> {
		const base = this.baseUrl();
		try {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), 5000);
			await fetch(`${base}/shutdown`, { method: "POST", signal: ctrl.signal });
			clearTimeout(timer);
		} catch {
			/* gateway already down or unreachable */
		}
		if (this.isGatewayRunning()) {
			this.runner().stopServer(() => {});
		}
	}

	async ensureGatewayRunning(opts: EnsureGatewayOptions = {}): Promise<void> {
		return ensureGatewayRunning(this, opts);
	}

	async ensureModelLoaded(
		slot: ModelSlot,
		opts?: { ensureServer?: boolean; onLog?: (line: string) => void }
	): Promise<void> {
		return this.switcher.ensureModelLoaded(slot, opts);
	}

	async downloadModel(
		service: CybriaServiceKey,
		modelId: string,
		onLog?: (line: string) => void
	): Promise<void> {
		const log = onLog ?? ((line: string) => this.appendLog(line));
		if (service === "llm") {
			await this.serviceRunner(SERVICE_TOOLS.llm).downloadModel(
				this.resolveToolsDir("llm"),
				modelId,
				log
			);
			return;
		}
		if (service === "summarize") {
			await this.summarize.downloadModel(modelId, this.serviceUrl("summarize"));
			return;
		}
		if (service === "tts") {
			await this.tts.downloadModel(modelId, this.serviceUrl("tts"));
			return;
		}
		throw new Error(`Download not supported for ${service}`);
	}

	/** Runner for per-service venv install/download (not the gateway process). */
	serviceRunner(toolsSubdir: string, extraEnv?: ServerEnvExtra): CybriaServerRunner {
		let r = this.serviceRunners.get(toolsSubdir);
		if (!r) {
			r = new CybriaServerRunner(toolsSubdir, extraEnv, () => this.modelPaths());
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
