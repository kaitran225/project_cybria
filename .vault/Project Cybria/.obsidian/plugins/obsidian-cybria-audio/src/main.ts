import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { AudioView, VIEW_TYPE_CYBRIA_AUDIO } from "./AudioView";
import { requireCybriaCore, type CybriaCoreApi } from "./require-core";
import { DEFAULT_SETTINGS, type AudioSettings } from "./settings";

export default class CybriaAudioPlugin extends Plugin {
	settings: AudioSettings = { ...DEFAULT_SETTINGS };
	core: CybriaCoreApi | null = null;
	lastAudioBuffer?: ArrayBuffer;

	async onload(): Promise<void> {
		await this.loadSettings();
		try {
			this.core = requireCybriaCore(this.app);
		} catch {
			// Notice shown when user opens view
		}

		this.registerView(VIEW_TYPE_CYBRIA_AUDIO, (leaf) => new AudioView(leaf, this));
		this.addRibbonIcon("audio-lines", "Open Cybria Audio", () => void this.activateView());
		this.addCommand({
			id: "open-sidebar",
			name: "Open Cybria Audio sidebar",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "speak-selection",
			name: "Speak selection",
			editorCallback: (editor) => {
				const text = editor.getSelection().trim();
				void this.activateView().then(() => {
					const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_AUDIO)[0]?.view;
					if (view instanceof AudioView) view.setText(text);
				});
			},
		});
		this.addSettingTab(new CybriaAudioSettingTab(this.app, this));
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
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CYBRIA_AUDIO)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_CYBRIA_AUDIO, active: true });
			leaf = right;
		}
		workspace.revealLeaf(leaf);
	}
}

class CybriaAudioSettingTab extends PluginSettingTab {
	plugin: CybriaAudioPlugin;
	constructor(app: App, plugin: CybriaAudioPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName("Server URL")
			.addText((t) =>
				t.setValue(this.plugin.settings.serverUrl).onChange(async (v) => {
					this.plugin.settings.serverUrl = v.trim();
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Output folder")
			.addText((t) =>
				t.setValue(this.plugin.settings.outputFolder).onChange(async (v) => {
					this.plugin.settings.outputFolder = v.trim();
					await this.plugin.saveSettings();
				})
			);
	}
}
