import { App, PluginSettingTab, Setting } from "obsidian";
import { CYBRIA_BASE_URL, CYBRIA_PORT } from "./servers";
import type { HardwareProfileId } from "./hardware-profiles";
import { listHardwareProfiles } from "./hardware-profiles";
import { defaultPortableModelRoot, resolveModelPaths } from "./model-paths";
import type CybriaCorePlugin from "./main";
import type { CybriaCoreSettings } from "./settings";

export class CybriaCoreSettingTab extends PluginSettingTab {
	plugin: CybriaCorePlugin;

	constructor(app: App, plugin: CybriaCorePlugin) {
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
			.setName("Hardware profile")
			.setDesc("Filters models by GPU VRAM and RAM. Hides tight / OOM-risk models on weaker profiles.")
			.addDropdown((d) => {
				for (const p of listHardwareProfiles()) {
					d.addOption(p.id, `${p.name} — ${p.description}`);
				}
				d.setValue(this.plugin.settings.hardwareProfile);
				d.onChange(async (v) => {
					this.plugin.applyHardwareProfile(v as HardwareProfileId);
					await this.plugin.saveSettings();
					this.display();
				});
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
			.setDesc("Override path to .tools/cybria-server. Leave empty to auto-detect from vault location.")
			.addText((t) =>
				t.setValue(this.plugin.settings.toolsPath).onChange(async (v) => {
					this.plugin.settings.toolsPath = v.trim();
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl("h3", { text: "Model storage" });
		containerEl.createEl("p", {
			text: "Absolute paths for downloaded models. Set the root folder; subfolders (LoRa, Qwen, llm, tts, summarization) are derived automatically unless overridden. Use %USERPROFILE% or ~ for portable paths.",
			cls: "setting-item-description",
		});

		const modelPathFields: Array<{
			key: keyof CybriaCoreSettings["modelPaths"];
			label: string;
			desc?: string;
		}> = [
			{ key: "root", label: "Model root", desc: "e.g. %USERPROFILE%\\.models or D:\\Models" },
			{ key: "loras", label: "LoRA folder", desc: "Default: <root>\\LoRa" },
			{ key: "huggingface", label: "Hugging Face / diffusion", desc: "Default: <root>\\Qwen" },
			{ key: "llm", label: "LLM (GGUF)", desc: "Default: <root>\\llm" },
			{ key: "tts", label: "TTS models", desc: "Default: <root>\\tts" },
			{ key: "summarization", label: "Summarization models", desc: "Default: <root>\\summarization" },
		];

		for (const field of modelPathFields) {
			new Setting(containerEl)
				.setName(field.label)
				.setDesc(field.desc ?? "")
				.addText((t) => {
					const resolved = resolveModelPaths(this.plugin.settings.modelPaths);
					const placeholder =
						field.key === "root"
							? defaultPortableModelRoot()
							: resolved[field.key];
					t.setPlaceholder(placeholder)
						.setValue(this.plugin.settings.modelPaths[field.key])
						.onChange(async (v) => {
							this.plugin.settings.modelPaths[field.key] = v.trim();
							await this.plugin.saveSettings();
						});
				});
		}

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
