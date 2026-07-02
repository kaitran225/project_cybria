import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { decodeBase64Png, generateImage, pingServer } from "./apps/image/client";
import { GenerateModal } from "./apps/image/GenerateModal";
import type { GenerateProgress } from "./apps/image/generate-options";
import type { OutputRecord } from "./apps/image/types";
import type { AppId } from "./apps/types";
import { CybriaCoreApi } from "./api";
import { migrateSatelliteSettings } from "./migrate-settings";
import { ModelSwitcherView, VIEW_TYPE_MODEL_SWITCHER } from "./ModelSwitcherView";
import type { ModelSlot } from "./catalog";
import { CYBRIA_BASE_URL, CYBRIA_PORT } from "./servers";
import { DEFAULT_SETTINGS, type CoreViewTab, type CybriaCoreSettings } from "./settings";

export default class CybriaCorePlugin extends Plugin {
	settings: CybriaCoreSettings = { ...DEFAULT_SETTINGS };
	api!: CybriaCoreApi;
	lastAudioBuffer: ArrayBuffer | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.api = new CybriaCoreApi(
			this.app,
			() => this.settings,
			() => ({ ...this.settings.activeModels }),
			async (slot, modelId) => {
				this.settings.activeModels[slot] = modelId;
				await this.saveSettings();
			}
		);

		this.registerView(VIEW_TYPE_MODEL_SWITCHER, (leaf) => new ModelSwitcherView(leaf, this));

		this.addRibbonIcon("layout-dashboard", "Cybria AI", () =>
			void this.activateSwitcher(this.settings.activeViewTab === "apps" ? "apps" : "dashboard")
		);

		this.registerCommands();
		this.addSettingTab(new CybriaCoreSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openDashboardOnStartup) {
				void this.activateSwitcher("dashboard");
			}
		});
	}

	private registerCommands(): void {
		const openApp = (id: AppId) => () => void this.activateSwitcher("apps", id);

		this.addCommand({ id: "open-dashboard", name: "Open Cybria AI home", callback: () => void this.activateSwitcher("dashboard") });
		this.addCommand({ id: "open-model-switcher", name: "Open Cybria AI", callback: () => void this.activateSwitcher() });
		this.addCommand({ id: "open-servers", name: "Open Cybria servers", callback: () => void this.activateSwitcher("servers") });
		this.addCommand({ id: "open-llm", name: "Open Cybria Chat", callback: openApp("llm") });
		this.addCommand({ id: "open-novel", name: "Open Cybria Novel", callback: openApp("novel") });
		this.addCommand({ id: "open-audio", name: "Open Cybria Audio", callback: openApp("audio") });
		this.addCommand({ id: "open-image-gen", name: "Open Image Gen", callback: openApp("image") });

		this.addCommand({ id: "activate-llm-model", name: "Load active LLM model", callback: () => void this.activateSlot("llm") });
		this.addCommand({ id: "activate-image-model", name: "Load active image model", callback: () => void this.activateSlot("image") });

		this.addCommand({
			id: "chat-with-selection",
			name: "Chat with selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateSwitcher("apps", "llm").then(() => {
					this.getSwitcherView()?.getAppsHost().getLlmPane().setInput(text);
				});
			},
		});

		this.addCommand({
			id: "continue-scene",
			name: "Continue scene from selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateSwitcher("apps", "novel").then(() => {
					this.getSwitcherView()?.getAppsHost().getNovelPane().setWriteText(text);
				});
			},
		});

		this.addCommand({
			id: "summarize-selection",
			name: "Summarize selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateSwitcher("apps", "novel").then(() => {
					this.getSwitcherView()?.getAppsHost().getNovelPane().setSummarizeText(text);
				});
			},
		});

		this.addCommand({
			id: "summarize-vault-topic",
			name: "Summarize vault topic (semantic)",
			callback: () => {
				void this.activateSwitcher("apps", "novel").then(() => {
					this.getSwitcherView()?.getAppsHost().getNovelPane().setSummarizeQuery("");
				});
			},
		});

		this.addCommand({
			id: "speak-selection",
			name: "Speak selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateSwitcher("apps", "audio").then(() => {
					this.getSwitcherView()?.getAppsHost().getAudioPane().setText(text);
				});
			},
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
				void this.activateSwitcher("apps", "image").then(() => {
					this.getSwitcherView()?.getAppsHost().getImagePane().setPrompt(text);
				});
			},
		});
	}

	getSwitcherView(): ModelSwitcherView | null {
		const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_MODEL_SWITCHER)[0]?.view;
		return view instanceof ModelSwitcherView ? view : null;
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
		const data = (await this.loadData()) as Partial<CybriaCoreSettings> & {
			serverUrls?: Record<string, string>;
		} | null;
		const legacyBase =
			data?.serverUrls?.gateway?.trim() ||
			data?.serverUrls?.llm?.replace(/\/llm\/?$/, "") ||
			"";
		const partial: Partial<CybriaCoreSettings> = {
			...(data ?? {}),
			baseUrl: data?.baseUrl?.trim() || legacyBase || DEFAULT_SETTINGS.baseUrl,
		};
		this.settings = await migrateSatelliteSettings(this.app, partial);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshImagePane();
	}

	async activateSwitcher(tab: CoreViewTab = "dashboard", appId?: AppId): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MODEL_SWITCHER)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_MODEL_SWITCHER, active: true });
			leaf = right;
		}
		await workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof ModelSwitcherView) view.showTab(tab, appId);
	}

	addOutputRecord(record: OutputRecord): void {
		this.settings.imageRecentOutputs = [
			record,
			...this.settings.imageRecentOutputs.filter((r) => r.path !== record.path),
		].slice(0, 24);
		void this.saveSettings();
	}

	refreshImagePane(): void {
		const pane = this.getSwitcherView()?.getAppsHost()?.getImagePane();
		pane?.renderGenParams();
		pane?.updateModelLabel();
		pane?.renderLoraPicker();
		pane?.renderOutput();
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

		const s = this.settings.image;
		const imageUrl = this.api.serverUrl("image");
		report(5, "Checking image server…");
		const health = await pingServer(imageUrl);
		if (!health.ready_to_generate && !health.ready) {
			throw new Error(
				health.error || "Image server not ready. Open Cybria AI → Servers to launch."
			);
		}

		report(12, `Generating ${s.width}×${s.height}…`);
		const modelId = this.api.switcher.getActiveModel("image");
		const result = await generateImage(
			imageUrl,
			{
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
			},
			s.generateTimeoutMinutes
		);

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
			if (editor) editor.replaceSelection(`![[${path}]]\n`);
		}

		return path;
	}
}

class CybriaCoreSettingTab extends PluginSettingTab {
	plugin: CybriaCorePlugin;

	constructor(app: import("obsidian").App, plugin: CybriaCorePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("p", {
			text: `All AI services share one gateway on port ${CYBRIA_PORT}.`,
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Open dashboard on startup")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.openDashboardOnStartup).onChange(async (v) => {
					this.plugin.settings.openDashboardOnStartup = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Gateway URL")
			.setDesc(`Default ${CYBRIA_BASE_URL}`)
			.addText((t) =>
				t
					.setPlaceholder(CYBRIA_BASE_URL)
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (v) => {
						this.plugin.settings.baseUrl = v.trim() || CYBRIA_BASE_URL;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Gateway tools path")
			.addText((t) =>
				t.setValue(this.plugin.settings.toolsPath).onChange(async (v) => {
					this.plugin.settings.toolsPath = v.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Terminal height")
			.addText((t) =>
				t.setValue(String(this.plugin.settings.terminalHeight)).onChange(async (v) => {
					const n = parseInt(v, 10);
					if (!isNaN(n) && n >= 80) {
						this.plugin.settings.terminalHeight = n;
						await this.plugin.saveSettings();
					}
				})
			);

		containerEl.createEl("h3", { text: "Chat" });
		new Setting(containerEl)
			.setName("System prompt")
			.addTextArea((t) =>
				t
					.setValue(this.plugin.settings.llm.systemPrompt)
					.onChange(async (v) => {
						this.plugin.settings.llm.systemPrompt = v;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Temperature")
			.addSlider((s) =>
				s
					.setLimits(0, 2, 0.05)
					.setValue(this.plugin.settings.llm.temperature)
					.onChange(async (v) => {
						this.plugin.settings.llm.temperature = v;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Novel" });
		new Setting(containerEl)
			.setName("Summaries folder")
			.addText((t) =>
				t.setValue(this.plugin.settings.novel.summariesFolder).onChange(async (v) => {
					this.plugin.settings.novel.summariesFolder = v.trim();
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl("h3", { text: "Audio" });
		new Setting(containerEl)
			.setName("Output folder")
			.addText((t) =>
				t.setValue(this.plugin.settings.audio.outputFolder).onChange(async (v) => {
					this.plugin.settings.audio.outputFolder = v.trim();
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl("h3", { text: "Image Gen" });
		new Setting(containerEl)
			.setName("Output folder")
			.addText((t) =>
				t.setValue(this.plugin.settings.image.outputFolder).onChange(async (v) => {
					this.plugin.settings.image.outputFolder = v.trim();
					await this.plugin.saveSettings();
				})
			);
	}
}
