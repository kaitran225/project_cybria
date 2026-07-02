import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { LlmView, VIEW_TYPE_CYBRIA_LLM } from "./LlmView";
import { requireCybriaCore, type CybriaCoreApi } from "./require-core";
import { DEFAULT_SETTINGS, type LlmSettings } from "./settings";

export default class CybriaLlmPlugin extends Plugin {
	settings: LlmSettings = { ...DEFAULT_SETTINGS };
	core: CybriaCoreApi | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		try {
			this.core = requireCybriaCore(this.app);
		} catch {
			new Notice("Cybria LLM requires Cybria Core — enable it in Settings → Community plugins.");
		}

		this.registerView(VIEW_TYPE_CYBRIA_LLM, (leaf) => new LlmView(leaf, this));

		this.addRibbonIcon("bot", "Open Cybria LLM", () => void this.activateView());

		this.addCommand({
			id: "open-sidebar",
			name: "Open Cybria LLM sidebar",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "chat-with-selection",
			name: "Chat with selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateView().then(() => {
					const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_LLM)[0]?.view;
					if (view instanceof LlmView) view.setInput(text);
				});
			},
		});

		this.addSettingTab(new CybriaLlmSettingTab(this.app, this));
	}

	getCore(): CybriaCoreApi {
		if (!this.core) this.core = requireCybriaCore(this.app);
		return this.core;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<LlmSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_LLM)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_CYBRIA_LLM, active: true });
			leaf = right;
		}
		workspace.revealLeaf(leaf);
	}
}

class CybriaLlmSettingTab extends PluginSettingTab {
	plugin: CybriaLlmPlugin;

	constructor(app: App, plugin: CybriaLlmPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("cybria-llm API (default http://127.0.0.1:8790)")
			.addText((t) =>
				t.setValue(this.plugin.settings.serverUrl).onChange(async (v) => {
					this.plugin.settings.serverUrl = v.trim();
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Tools path")
			.setDesc("Override .tools/cybria-llm path (leave empty for auto)")
			.addText((t) =>
				t.setValue(this.plugin.settings.toolsPath).onChange(async (v) => {
					this.plugin.settings.toolsPath = v.trim();
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("System prompt")
			.addTextArea((t) =>
				t
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (v) => {
						this.plugin.settings.systemPrompt = v;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Temperature")
			.addSlider((s) =>
				s
					.setLimits(0, 2, 0.1)
					.setValue(this.plugin.settings.temperature)
					.onChange(async (v) => {
						this.plugin.settings.temperature = v;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Max tokens")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.maxTokens))
					.onChange(async (v) => {
						const n = parseInt(v, 10);
						if (!isNaN(n)) {
							this.plugin.settings.maxTokens = n;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
