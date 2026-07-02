import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { NovelView, VIEW_TYPE_CYBRIA_NOVEL } from "./NovelView";
import { requireCybriaCore, type CybriaCoreApi } from "./require-core";
import { DEFAULT_SETTINGS, type NovelSettings } from "./settings";

export default class CybriaNovelPlugin extends Plugin {
	settings: NovelSettings = { ...DEFAULT_SETTINGS };
	core: CybriaCoreApi | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		try {
			this.core = requireCybriaCore(this.app);
		} catch {
			new Notice("Cybria Novel requires Cybria Core — enable it in Settings → Community plugins.");
		}

		this.registerView(VIEW_TYPE_CYBRIA_NOVEL, (leaf) => new NovelView(leaf, this));
		this.addRibbonIcon("book-open", "Open Cybria Novel", () => void this.activateView());
		this.addCommand({
			id: "open-sidebar",
			name: "Open Cybria Novel sidebar",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "summarize-selection",
			name: "Summarize selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateView().then(() => {
					const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_NOVEL)[0]?.view;
					if (view instanceof NovelView) {
						view.setSummarizeText(text);
						view.setWriteText(text);
					}
				});
			},
		});
		this.addCommand({
			id: "continue-scene",
			name: "Continue scene from selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateView().then(() => {
					const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_NOVEL)[0]?.view;
					if (view instanceof NovelView) view.setWriteText(text);
				});
			},
		});
		this.addSettingTab(new CybriaNovelSettingTab(this.app, this));
	}

	getCore(): CybriaCoreApi {
		if (!this.core) this.core = requireCybriaCore(this.app);
		return this.core;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_NOVEL)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_CYBRIA_NOVEL, active: true });
			leaf = right;
		}
		workspace.revealLeaf(leaf);
	}
}

class CybriaNovelSettingTab extends PluginSettingTab {
	plugin: CybriaNovelPlugin;
	constructor(app: App, plugin: CybriaNovelPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName("LLM server URL")
			.addText((t) =>
				t.setValue(this.plugin.settings.llmServerUrl).onChange(async (v) => {
					this.plugin.settings.llmServerUrl = v.trim();
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Summarize server URL")
			.addText((t) =>
				t.setValue(this.plugin.settings.summarizeServerUrl).onChange(async (v) => {
					this.plugin.settings.summarizeServerUrl = v.trim();
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Summaries folder")
			.addText((t) =>
				t.setValue(this.plugin.settings.summariesFolder).onChange(async (v) => {
					this.plugin.settings.summariesFolder = v.trim();
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Write system prompt")
			.addTextArea((t) =>
				t.setValue(this.plugin.settings.writePrompt).onChange(async (v) => {
					this.plugin.settings.writePrompt = v;
					await this.plugin.saveSettings();
				})
			);
	}
}
