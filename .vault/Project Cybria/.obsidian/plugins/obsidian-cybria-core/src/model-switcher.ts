import type { CybriaCoreApi } from "./api";
import {
	getCatalogModel,
	serverForSlot,
	ALL_MODEL_SLOTS,
	type CatalogModel,
	type ModelSlot,
} from "./catalog";
import {
	catalogForProfile,
	getHardwareProfile,
	isModelVisibleForProfile,
} from "./hardware-profiles";
import { gatewayHealthToSlotState, parseServiceHealth } from "./gateway-health";
import type { CybriaServiceKey } from "./servers";

const HEAVY_SERVICES: CybriaServiceKey[] = ["llm", "image"];

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

export class ModelSwitcher {
	private listeners = new Set<SwitcherListener>();
	private slotState = new Map<ModelSlot, SlotState>();
	private loadingSlot: ModelSlot | null = null;

	constructor(
		private readonly api: CybriaCoreApi,
		private getActive: () => Record<ModelSlot, string>,
		private setActive: (slot: ModelSlot, modelId: string) => Promise<void>
	) {
		for (const slot of ALL_MODEL_SLOTS) {
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
		return [...ALL_MODEL_SLOTS];
	}

	listModels(slot: ModelSlot): CatalogModel[] {
		return catalogForProfile(slot, this.api.hardwareProfileId());
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
		const url = this.api.serviceUrl(service);
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
		const url = this.api.serviceUrl(service);
		const deadline = Date.now() + (service === "image" ? 900_000 : timeoutMs);
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
					if (h.loading && h.model_id === modelId) {
						await new Promise((r) => setTimeout(r, 2000));
						continue;
					}
					if (h.error && !h.loading) throw new Error(h.error);
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (/not reachable|fetch|503|504|connection|timed out/i.test(msg)) {
					await new Promise((r) => setTimeout(r, 2000));
					continue;
				}
				throw e;
			}
			await new Promise((r) => setTimeout(r, 1500));
		}
		throw new Error("Timed out waiting for model to load");
	}

	/** Refresh health for all slots from the gateway /health snapshot (no per-service proxy pings). */
	async refresh(): Promise<void> {
		const localProc = this.api.isGatewayRunning();
		const health = localProc ? await this.api.fetchGatewayHealth() : null;
		const gatewayUp = !!(localProc || health);

		for (const slot of this.listSlots()) {
			const service = serverForSlot(slot);
			this.patch(slot, {
				serverRunning: gatewayUp,
				activeModelId: this.getActive()[slot],
			});
			if (!health) {
				this.patch(slot, { status: "idle", loadedModelId: null, error: null });
				continue;
			}
			this.applyGatewayHealth(slot, service, health.services?.[service]);
		}
	}

	private async isModelReadyOnServer(
		service: CybriaServiceKey,
		modelId: string
	): Promise<boolean> {
		const url = this.api.serviceUrl(service);
		try {
			if (service === "llm") {
				const h = await this.api.llm.ping(url);
				return !!(h.ready && h.model_id === modelId);
			}
			if (service === "summarize") {
				const h = await this.api.summarize.ping(url);
				return !!h.ready;
			}
			if (service === "tts") {
				const h = await this.api.tts.ping(url);
				return !!h.ready;
			}
			if (service === "image") {
				const h = await this.api.image.ping(url);
				return !!(h.ready && h.model_id === modelId);
			}
		} catch {
			return false;
		}
		return false;
	}

	/** Load the active model for a slot if not already ready on the server. */
	async ensureModelLoaded(
		slot: ModelSlot,
		opts?: { ensureServer?: boolean; onLog?: (line: string) => void }
	): Promise<void> {
		const modelId = this.getActiveModel(slot);
		const service = serverForSlot(slot);
		if (await this.isModelReadyOnServer(service, modelId)) {
			this.patch(slot, {
				status: "ready",
				loadedModelId: modelId,
				activeModelId: modelId,
				error: null,
				serverRunning: true,
			});
			return;
		}
		await this.activate(slot, modelId, opts);
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
		const profile = getHardwareProfile(this.api.hardwareProfileId());
		if (!isModelVisibleForProfile(entry, profile)) {
			throw new Error(`${entry.name} is not available on profile ${profile.name}`);
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

			if (opts?.ensureServer !== false) {
				await this.api.ensureGatewayRunning({ onLog: log });
			} else if (!(this.api.isGatewayRunning() || (await this.api.fetchGatewayHealth()))) {
				throw new Error("Cybria server not running — launch gateway first");
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

	private applyGatewayHealth(
		slot: ModelSlot,
		_service: CybriaServiceKey,
		raw: Record<string, unknown> | undefined
	): void {
		const parsed = parseServiceHealth(raw);
		const patch = gatewayHealthToSlotState(parsed, this.getActive()[slot]);
		this.patch(slot, patch);
	}
}
