import { App, Plugin, PluginSettingTab, Setting, Notice, WorkspaceLeaf } from "obsidian";
import { decodeBase64Png, generateImage, pingServer } from "./client";
import { GenerateModal } from "./GenerateModal";
import { ImageGenView, VIEW_TYPE_IMAGE_GEN } from "./ImageGenView";
import { ImageServerRunner } from "./server-launcher";
import { DEFAULT_SETTINGS, type ImageGenSettings } from "./settings";
import type { OutputRecord } from "./types";
import type { GenerateProgress } from "./generate-options";

interface PersistedData extends Partial<ImageGenSettings> {
	recentOutputs?: OutputRecord[];
}

export default class ImageGenPlugin extends Plugin {
	settings: ImageGenSettings = DEFAULT_SETTINGS;
	recentOutputs: OutputRecord[] = [];
	serverRunner = new ImageServerRunner();

	async onload(): Promise<void> {
		await this.loadSettings();

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

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as PersistedData | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.recentOutputs = data?.recentOutputs ?? [];
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			...this.settings,
			recentOutputs: this.recentOutputs,
		});
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
			if (view instanceof ImageGenView) view.renderOutput();
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
		report(5, "Checking image server…");
		const health = await pingServer(s.serverUrl);
		if (!health.ready_to_generate && !health.ready) {
			throw new Error(
				health.error ||
					"Image server not ready. Use Launch server in the Image Gen sidebar."
			);
		}

		report(12, `Generating ${s.width}×${s.height}…`);
		const result = await generateImage(s.serverUrl, {
			prompt,
			width: s.width,
			height: s.height,
			steps: s.steps,
			cfg: s.cfg,
			seed: s.seed || undefined,
			negativePrompt: s.negativePrompt,
		});

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
			text: "Open the Image Gen sidebar (ribbon icon) to launch the server, check health, and view output.",
		});

		new Setting(containerEl)
			.setName("Server URL")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (v) => {
						this.plugin.settings.serverUrl = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Qwen tools path")
			.setDesc("Optional override. Default: <repo>/.tools/qwen-image")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.qwenToolsPath)
					.onChange(async (v) => {
						this.plugin.settings.qwenToolsPath = v.trim();
						await this.plugin.saveSettings();
					})
			);

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
			.setName("Width")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.width))
					.onChange(async (v) => {
						this.plugin.settings.width = Number(v) || 768;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Height")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.height))
					.onChange(async (v) => {
						this.plugin.settings.height = Number(v) || 768;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Steps")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.steps))
					.onChange(async (v) => {
						this.plugin.settings.steps = Number(v) || 20;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("CFG scale")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.cfg))
					.onChange(async (v) => {
						this.plugin.settings.cfg = Number(v) || 4;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Negative prompt")
			.addTextArea((t) => {
				t.setValue(this.plugin.settings.negativePrompt);
				t.inputEl.rows = 2;
				t.onChange(async (v) => {
					this.plugin.settings.negativePrompt = v;
					await this.plugin.saveSettings();
				});
			});
	}
}
