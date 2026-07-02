import type { CybriaCoreApi } from "./api";
import {
	catalogForSlot,
	getCatalogModel,
	serverForSlot,
	type CatalogModel,
	type ModelSlot,
} from "./catalog";
import type { CybriaServerKey } from "./servers";
import { CYBRIA_SERVERS } from "./servers";

export type SwitchStatus = "idle" | "loading" | "ready" | "error";

export interface SlotState {
	slot: ModelSlot;
	activeModelId: string;
	loadedModelId: string | null;
	status: SwitchStatus;
	error: string | null;
	serverRunning: boolean;
}

export type SwitcherListener = (slot: ModelSlot, state: SlotState) => void;

const HEAVY_SERVERS: CybriaServerKey[] = ["llm", "image", "tts"];

export class ModelSwitcher {
	private listeners = new Set<SwitcherListener>();
	private slotState = new Map<ModelSlot, SlotState>();
	private loadingSlot: ModelSlot | null = null;

	constructor(
		private readonly api: CybriaCoreApi,
		private getActive: () => Record<ModelSlot, string>,
		private setActive: (slot: ModelSlot, modelId: string) => Promise<void>
	) {
		for (const slot of ["llm", "novel", "summarize", "tts", "image"] as ModelSlot[]) {
			this.slotState.set(slot, this.emptyState(slot));
		}
	}

	private emptyState(slot: ModelSlot): SlotState {
		return {
			slot,
			activeModelId: this.getActive()[slot],
			loadedModelId: null,
			status: "idle",
			error: null,
			serverRunning: false,
		};
	}

	onChange(fn: SwitcherListener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private emit(slot: ModelSlot): void {
		const state = this.slotState.get(slot);
		if (state) {
			for (const fn of this.listeners) fn(slot, { ...state });
		}
	}

	private patch(slot: ModelSlot, patch: Partial<SlotState>): void {
		const cur = this.slotState.get(slot) ?? this.emptyState(slot);
		this.slotState.set(slot, { ...cur, ...patch });
		this.emit(slot);
	}

	listSlots(): ModelSlot[] {
		return ["llm", "novel", "summarize", "tts", "image"];
	}

	listModels(slot: ModelSlot): CatalogModel[] {
		return catalogForSlot(slot);
	}

	getActiveModel(slot: ModelSlot): string {
		return this.getActive()[slot];
	}

	getState(slot: ModelSlot): SlotState {
		return { ...(this.slotState.get(slot) ?? this.emptyState(slot)) };
	}

	allStates(): SlotState[] {
		return this.listSlots().map((s) => this.getState(s));
	}

	serverUrl(server: CybriaServerKey): string {
		return CYBRIA_SERVERS[server].defaultUrl;
	}

	isServerRunning(server: CybriaServerKey): boolean {
		return this.api.runner(server).isRunning();
	}

	/** Stop other heavy GPU servers before loading a new heavy model. */
	private async releaseHeavyExcept(keep: CybriaServerKey): Promise<void> {
		for (const s of HEAVY_SERVERS) {
			if (s === keep) continue;
			const runner = this.api.runner(s);
			if (runner.isRunning()) {
				await new Promise<void>((resolve) => {
					runner.stopServer(() => resolve());
				});
			}
		}
	}

	private async loadOnServer(
		server: CybriaServerKey,
		modelId: string
	): Promise<void> {
		const url = this.serverUrl(server);
		switch (server) {
			case "llm":
				await this.api.llm.loadModel(modelId, url);
				break;
			case "summarize":
				await this.api.summarize.loadModel(modelId, url);
				break;
			case "tts":
				await this.api.tts.loadModel(url);
				break;
			case "image":
				await this.api.image.loadModel(modelId, url);
				break;
		}
	}

	private async pollLoaded(
		slot: ModelSlot,
		server: CybriaServerKey,
		modelId: string,
		timeoutMs = 300_000
	): Promise<void> {
		const url = this.serverUrl(server);
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			try {
				if (server === "llm") {
					const h = await this.api.llm.ping(url);
					if (h.ready && h.model_id === modelId) return;
					if (h.error && !h.loading) throw new Error(h.error);
				} else if (server === "summarize") {
					const h = await this.api.summarize.ping(url);
					if (h.ready) return;
				} else if (server === "tts") {
					const h = await this.api.tts.ping(url);
					if (h.ready) return;
					if (h.error) throw new Error(h.error);
				} else if (server === "image") {
					const h = await this.api.image.ping(url);
					if (h.ready && h.model_id === modelId) return;
					if (h.error && !h.loading) throw new Error(h.error);
				}
			} catch (e) {
				if (e instanceof Error && !/not reachable|fetch/i.test(e.message)) throw e;
			}
			await new Promise((r) => setTimeout(r, 1500));
		}
		throw new Error("Timed out waiting for model to load");
	}

	/**
	 * Select and load the model for a slot. Ensures server is running, unloads conflicting heavy models.
	 */
	async activate(
		slot: ModelSlot,
		modelId: string,
		opts?: { ensureServer?: boolean; onLog?: (line: string) => void }
	): Promise<void> {
		if (this.loadingSlot) {
			throw new Error(`Busy loading ${this.loadingSlot}`);
		}
		const entry = getCatalogModel(modelId);
		if (!entry || entry.slot !== slot) {
			throw new Error(`Unknown model ${modelId} for slot ${slot}`);
		}

		const server = serverForSlot(slot);
		const log = opts?.onLog ?? (() => undefined);
		this.loadingSlot = slot;
		this.patch(slot, {
			status: "loading",
			error: null,
			activeModelId: modelId,
			serverRunning: this.api.runner(server).isRunning(),
		});

		try {
			if (entry.vram === "heavy") {
				log(`[switcher] releasing other heavy servers before ${entry.name}`);
				await this.releaseHeavyExcept(server);
			}

			const runner = this.api.runner(server);
			if (!runner.isRunning()) {
				if (opts?.ensureServer === false) {
					throw new Error(`${server} server not running — launch it first`);
				}
				log(`[switcher] launching ${server} server`);
				const toolsDir = this.api.resolveToolsDir(server);
				runner.launchServer(toolsDir, log);
				await new Promise((r) => setTimeout(r, 2000));
			}

			this.patch(slot, { serverRunning: true });
			log(`[switcher] loading ${modelId} on ${server}`);
			await this.loadOnServer(server, modelId);
			await this.pollLoaded(slot, server, modelId);

			await this.setActive(slot, modelId);
			this.patch(slot, {
				status: "ready",
				loadedModelId: modelId,
				activeModelId: modelId,
				error: null,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.patch(slot, { status: "error", error: msg });
			throw e;
		} finally {
			this.loadingSlot = null;
		}
	}

	/** Refresh health for all slots from running servers. */
	async refresh(): Promise<void> {
		for (const slot of this.listSlots()) {
			const server = serverForSlot(slot);
			const running = this.api.runner(server).isRunning();
			this.patch(slot, {
				serverRunning: running,
				activeModelId: this.getActive()[slot],
			});
			if (!running) {
				this.patch(slot, { status: "idle", loadedModelId: null });
				continue;
			}
			try {
				const url = this.serverUrl(server);
				let loaded: string | null = null;
				let ready = false;
				if (server === "llm") {
					const h = await this.api.llm.ping(url);
					loaded = h.model_id ?? null;
					ready = !!h.ready;
					this.patch(slot, {
						loadedModelId: loaded,
						status: h.loading ? "loading" : ready ? "ready" : "idle",
						error: h.error ?? null,
					});
				} else if (server === "summarize") {
					const h = await this.api.summarize.ping(url);
					ready = !!h.ready;
					this.patch(slot, {
						status: ready ? "ready" : "idle",
						loadedModelId: this.getActive()[slot],
						error: h.error ?? null,
					});
				} else if (server === "tts") {
					const h = await this.api.tts.ping(url);
					ready = !!h.ready;
					this.patch(slot, {
						status: ready ? "ready" : "idle",
						error: h.error ?? null,
					});
				} else if (server === "image") {
					const h = await this.api.image.ping(url);
					loaded = h.model_id ?? null;
					ready = !!h.ready;
					this.patch(slot, {
						loadedModelId: loaded,
						status: h.loading ? "loading" : ready ? "ready" : "idle",
						error: h.error ?? null,
					});
				}
			} catch {
				this.patch(slot, { status: "idle", serverRunning: running });
			}
		}
	}
}
