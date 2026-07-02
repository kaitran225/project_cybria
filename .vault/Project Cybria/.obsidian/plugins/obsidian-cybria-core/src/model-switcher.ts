import type { CybriaCoreApi } from "./api";
import {
	catalogForSlot,
	getCatalogModel,
	serverForSlot,
	type CatalogModel,
	type ModelSlot,
} from "./catalog";
import type { CybriaServiceKey } from "./servers";
import { CYBRIA_PORT } from "./servers";

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

const HEAVY_SERVICES: CybriaServiceKey[] = ["llm", "image"];

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

	activeModelName(slot: ModelSlot): string {
		const id = this.getActiveModel(slot);
		return getCatalogModel(id)?.name ?? id;
	}

	getState(slot: ModelSlot): SlotState {
		return { ...(this.slotState.get(slot) ?? this.emptyState(slot)) };
	}

	allStates(): SlotState[] {
		return this.listSlots().map((s) => this.getState(s));
	}

	serverUrl(service: CybriaServiceKey): string {
		return this.api.serviceUrl(service);
	}

	isServerRunning(_service: CybriaServiceKey): boolean {
		return this.api.isGatewayRunning();
	}

	/** Stop other heavy GPU services before loading a new heavy model. */
	private async releaseHeavyExcept(keep: CybriaServiceKey): Promise<void> {
		for (const s of HEAVY_SERVICES) {
			if (s === keep) continue;
			await this.api.stopService(s);
		}
	}

	private async loadOnServer(
		service: CybriaServiceKey,
		modelId: string
	): Promise<void> {
		const url = this.serverUrl(service);
		switch (service) {
			case "llm":
				await this.api.llm.loadModel(modelId, url);
				break;
			case "summarize":
				await this.api.summarize.loadModel(modelId, url);
				break;
			case "tts":
				await this.api.tts.loadModel(modelId, url);
				break;
			case "image":
				await this.api.image.loadModel(modelId, url);
				break;
		}
	}

	private async pollLoaded(
		slot: ModelSlot,
		service: CybriaServiceKey,
		modelId: string,
		timeoutMs = 300_000
	): Promise<void> {
		const url = this.serverUrl(service);
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			try {
				if (service === "llm") {
					const h = await this.api.llm.ping(url);
					if (h.ready && h.model_id === modelId) return;
					if (h.error && !h.loading) throw new Error(h.error);
				} else if (service === "summarize") {
					const h = await this.api.summarize.ping(url);
					if (h.ready) return;
				} else if (service === "tts") {
					const h = await this.api.tts.ping(url);
					if (h.ready) return;
					if (h.error) throw new Error(h.error);
				} else if (service === "image") {
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

		const service = serverForSlot(slot);
		const log = opts?.onLog ?? ((line: string) => this.api.appendLog(line));
		this.loadingSlot = slot;
		this.patch(slot, {
			status: "loading",
			error: null,
			activeModelId: modelId,
			serverRunning: this.api.isGatewayRunning(),
		});

		try {
			if (entry.vram === "heavy") {
				log(`[switcher] releasing other heavy services before ${entry.name}`);
				await this.releaseHeavyExcept(service);
			}

			if (!this.api.isGatewayRunning()) {
				if (opts?.ensureServer === false) {
					throw new Error(`Cybria server not running — launch gateway first`);
				}
				log(`[switcher] launching cybria-server on :${CYBRIA_PORT}`);
				const toolsDir = this.api.resolveToolsDir("gateway");
				this.api.runner().launchServer(toolsDir, log);
				await new Promise((r) => setTimeout(r, 3000));
			}

			this.patch(slot, { serverRunning: true });
			log(`[switcher] loading ${modelId} via ${service}`);
			await this.loadOnServer(service, modelId);
			await this.pollLoaded(slot, service, modelId);

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
			const service = serverForSlot(slot);
			const running = this.api.isGatewayRunning();
			this.patch(slot, {
				serverRunning: running,
				activeModelId: this.getActive()[slot],
			});
			if (!running) {
				this.patch(slot, { status: "idle", loadedModelId: null });
				continue;
			}
			try {
				const url = this.serverUrl(service);
				let loaded: string | null = null;
				let ready = false;
				if (service === "llm") {
					const h = await this.api.llm.ping(url);
					loaded = h.model_id ?? null;
					ready = !!h.ready;
					this.patch(slot, {
						loadedModelId: loaded,
						status: h.loading ? "loading" : ready ? "ready" : "idle",
						error: h.error ?? null,
					});
				} else if (service === "summarize") {
					const h = await this.api.summarize.ping(url);
					ready = !!h.ready;
					this.patch(slot, {
						status: ready ? "ready" : "idle",
						loadedModelId: this.getActive()[slot],
						error: h.error ?? null,
					});
				} else if (service === "tts") {
					const h = await this.api.tts.ping(url);
					ready = !!h.ready;
					loaded = h.model_id ?? this.getActive()[slot];
					this.patch(slot, {
						loadedModelId: loaded,
						status: ready ? "ready" : "idle",
						error: h.error ?? null,
					});
				} else if (service === "image") {
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
