import { Notice, Plugin } from "obsidian";
import { CybriaCoreApi } from "./api";
import { ModelSwitcherView, VIEW_TYPE_MODEL_SWITCHER } from "./ModelSwitcherView";
import type { ModelSlot } from "./catalog";
import { DEFAULT_SETTINGS, type CybriaCoreSettings } from "./settings";

export default class CybriaCorePlugin extends Plugin {
	settings: CybriaCoreSettings = { ...DEFAULT_SETTINGS };
	api!: CybriaCoreApi;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.api = new CybriaCoreApi(
			this.app,
			() => ({ ...this.settings.activeModels }),
			async (slot, modelId) => {
				this.settings.activeModels[slot] = modelId;
				await this.saveSettings();
			}
		);

		this.registerView(VIEW_TYPE_MODEL_SWITCHER, (leaf) => new ModelSwitcherView(leaf, this));

		this.addRibbonIcon("cpu", "Cybria Model Switcher", () => void this.activateSwitcher());

		this.addCommand({
			id: "open-model-switcher",
			name: "Open model switcher",
			callback: () => void this.activateSwitcher(),
		});

		this.addCommand({
			id: "activate-llm-model",
			name: "Load active LLM model",
			callback: () => void this.activateSlot("llm"),
		});

		this.addCommand({
			id: "activate-image-model",
			name: "Load active image model",
			callback: () => void this.activateSlot("image"),
		});
	}

	private async activateSlot(slot: ModelSlot): Promise<void> {
		const modelId = this.settings.activeModels[slot];
		try {
			await this.api.switcher.activate(slot, modelId, { ensureServer: true });
			new Notice(`${slot} model loaded: ${modelId}`);
		} catch (e) {
			new Notice(`Failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<CybriaCoreSettings> | null;
		this.settings = {
			activeModels: {
				...DEFAULT_SETTINGS.activeModels,
				...(data?.activeModels ?? {}),
			},
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async activateSwitcher(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MODEL_SWITCHER)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_MODEL_SWITCHER, active: true });
			leaf = right;
		}
		await workspace.revealLeaf(leaf);
	}
}
