import { App, Modal, Notice, Setting } from "obsidian";
import type ImageGenPlugin from "./main";

export class GenerateModal extends Modal {
	private prompt = "";
	private busy = false;

	constructor(app: App, private plugin: ImageGenPlugin, initialPrompt = "") {
		super(app);
		this.prompt = initialPrompt;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("image-gen-modal");

		contentEl.createEl("h2", { text: "Generate image" });

		new Setting(contentEl)
			.setName("Prompt")
			.addTextArea((area) => {
				area.setValue(this.prompt);
				area.inputEl.rows = 5;
				area.onChange((v) => (this.prompt = v));
				window.setTimeout(() => area.inputEl.focus(), 0);
			});

		const status = contentEl.createDiv({ cls: "image-gen-status" });
		status.setText(
			`${this.plugin.settings.width}×${this.plugin.settings.height} · ${this.plugin.settings.steps} steps`
		);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(this.busy ? "Generating…" : "Generate")
					.setCta()
					.setDisabled(this.busy)
					.onClick(() => void this.runGenerate(status))
			)
			.addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
	}

	private async runGenerate(statusEl: HTMLElement): Promise<void> {
		const prompt = this.prompt.trim();
		if (!prompt) {
			new Notice("Enter a prompt");
			return;
		}

		this.busy = true;
		statusEl.setText("Connecting to image server…");
		try {
			const path = await this.plugin.generateAndInsert(prompt, statusEl);
			new Notice(`Image saved: ${path}`);
			this.close();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			statusEl.setText(msg);
			new Notice(msg, 8000);
		} finally {
			this.busy = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
