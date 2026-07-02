import { App, Plugin, PluginSettingTab, Setting, Notice, WorkspaceLeaf } from "obsidian";
import { decodeBase64Png, generateImage, pingServer } from "./client";
import { GenerateModal } from "./GenerateModal";
import { ImageGenView, VIEW_TYPE_IMAGE_GEN } from "./ImageGenView";
import { requireCybriaCore, type CybriaCoreApi } from "./require-core";
import { DEFAULT_SETTINGS, type ImageGenSettings } from "./settings";
import type { OutputRecord } from "./types";
import type { GenerateProgress } from "./generate-options";

interface PersistedData extends Partial<ImageGenSettings> {
	recentOutputs?: OutputRecord[];
	migratedFast512?: boolean;
}

export default class ImageGenPlugin extends Plugin {
	settings: ImageGenSettings = DEFAULT_SETTINGS;
	recentOutputs: OutputRecord[] = [];
	core: CybriaCoreApi | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		try {
			this.core = requireCybriaCore(this.app);
		} catch {
			new Notice("Image Gen requires Cybria Core — enable it in Settings → Community plugins.");
		}

		this.registerView(VIEW_TYPE_IMAGE_GEN, (leaf) => new ImageGenView(leaf, this));

		this.addRibbonIcon("image", "Open Image Gen", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-sidebar",
			name: "Open Image Gen sidebar",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "generate-image",
			name: "Generate image (modal)",
			callback: () => new GenerateModal(this.app, this).open(),
		});

		this.addCommand({
			id: "generate-from-selection",
			name: "Generate image from selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateView().then(() => {
					const view = this.app.workspace
						.getLeavesOfType(VIEW_TYPE_IMAGE_GEN)[0]?.view;
					if (view instanceof ImageGenView) view.setPrompt(text);
				});
			},
		});

		this.addSettingTab(new ImageGenSettingTab(this.app, this));
	}

	getCore(): CybriaCoreApi {
		if (!this.core) this.core = requireCybriaCore(this.app);
		return this.core;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as PersistedData | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.recentOutputs = data?.recentOutputs ?? [];

		if (!data?.migratedFast512) {
			const s = this.settings;
			if (s.width === 768 && s.height === 768 && s.steps === 20 && s.cfg === 4) {
				s.width = 512;
				s.height = 512;
				s.steps = 8;
				s.cfg = 1.0;
			}
			await this.saveData({
				...s,
				recentOutputs: this.recentOutputs,
				migratedFast512: true,
			});
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			...this.settings,
			recentOutputs: this.recentOutputs,
		});
		this.refreshViews();
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_IMAGE_GEN)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE_IMAGE_GEN, active: true });
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}

	addOutputRecord(record: OutputRecord): void {
		this.recentOutputs = [
			record,
			...this.recentOutputs.filter((r) => r.path !== record.path),
		].slice(0, 24);
		void this.saveSettings();
		this.refreshViews();
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_IMAGE_GEN)) {
			const view = leaf.view;
			if (view instanceof ImageGenView) {
				view.renderGenParams();
				view.updateModelLabel();
				view.renderLoraPicker();
				view.renderOutput();
			}
		}
	}

	async generateAndInsert(
		prompt: string,
		opts: GenerateProgress | HTMLElement = {},
		legacyRefreshSidebar = false
	): Promise<string> {
		const options: GenerateProgress =
			opts instanceof HTMLElement
				? { statusEl: opts, refreshSidebar: legacyRefreshSidebar }
				: opts;
		const { statusEl, refreshSidebar = false, onProgress } = options;

		const report = (pct: number, label: string) => {
			onProgress?.(pct, label);
			statusEl?.setText(label);
		};

		const s = this.settings;
		const imageUrl = this.getCore().serverUrl("image");
		report(5, "Checking image server…");
		const health = await pingServer(imageUrl);
		if (!health.ready_to_generate && !health.ready) {
			throw new Error(
				health.error ||
					"Image server not ready. Open Cybria AI → Servers to launch."
			);
		}

		report(12, `Generating ${s.width}×${s.height}…`);
		const modelId = this.getCore().switcher.getActiveModel("image");
		const result = await generateImage(imageUrl, {
			prompt,
			model: modelId,
			width: s.width,
			height: s.height,
			steps: s.steps,
			cfg: s.cfg,
			seed: s.seed || undefined,
			negativePrompt: s.negativePrompt,
			lora: s.lora || undefined,
			loraScale: s.loraScale,
		}, s.generateTimeoutMinutes);

		report(96, "Saving to vault…");

		const folder = s.outputFolder.replace(/\\/g, "/").replace(/\/+$/, "");
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `${stamp}-seed${result.seed}.png`;
		const path = `${folder}/${fileName}`;

		if (!(await this.app.vault.adapter.exists(folder))) {
			await this.app.vault.createFolder(folder);
		}

		const bytes = decodeBase64Png(result.imageBase64);
		await this.app.vault.createBinary(path, bytes);

		this.addOutputRecord({
			path,
			prompt,
			seed: result.seed,
			createdAt: Date.now(),
		});

		if (!refreshSidebar) {
			const editor = this.app.workspace.activeEditor?.editor;
			if (editor) {
				editor.replaceSelection(`![[${path}]]\n`);
			}
		}

		return path;
	}
}

class ImageGenSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ImageGenPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Image generation" });
		containerEl.createEl("p", {
			text: "Image server is managed in Cybria Core. Size, steps, and model are in the Image Gen sidebar.",
		});

		new Setting(containerEl)
			.setName("Output folder")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (v) => {
						this.plugin.settings.outputFolder = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Generation timeout (minutes)")
			.setDesc("0 = no limit. Increase only if you want to cap long runs.")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.generateTimeoutMinutes))
					.onChange(async (v) => {
						this.plugin.settings.generateTimeoutMinutes = Math.max(0, Number(v) || 0);
						await this.plugin.saveSettings();
					})
			);
	}
}
