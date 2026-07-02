import { MarkdownView, Notice, setIcon } from "obsidian";
import type CybriaCorePlugin from "../../main";
import type { AppPane } from "../types";

export class AudioPane implements AppPane {
	private root: HTMLElement | null = null;
	private inputEl!: HTMLTextAreaElement;
	private statusEl!: HTMLElement;
	private statusDotEl!: HTMLElement;
	private modelEl!: HTMLElement;
	private playerEl!: HTMLElement;
	private lastAudioUrl: string | null = null;
	private unsubSwitcher: (() => void) | null = null;

	constructor(private readonly plugin: CybriaCorePlugin) {}

	setText(text: string): void {
		if (this.inputEl) this.inputEl.value = text;
	}

	mount(root: HTMLElement): void {
		this.root = root;
		root.empty();
		root.addClass("caud-root");

		const header = root.createDiv("caud-header");
		const titleBlock = header.createDiv("caud-title-block");
		titleBlock.createDiv("caud-header-title").setText("Text to Speech");
		this.modelEl = titleBlock.createSpan({ cls: "caud-header-model" });
		const statusWrap = header.createDiv("caud-status-wrap");
		this.statusDotEl = statusWrap.createDiv("caud-status-dot");
		this.statusEl = statusWrap.createSpan("caud-status-text");

		const scriptCard = root.createDiv("caud-card");
		scriptCard.createSpan({ cls: "caud-card-label", text: "Script" });
		this.inputEl = scriptCard.createEl("textarea", {
			cls: "caud-textarea",
			attr: { placeholder: "Enter text to speak aloud…", rows: "6" },
		});

		const actions = root.createDiv("caud-actions");
		const genBtn = actions.createEl("button", { cls: "mod-cta caud-primary-btn" });
		setIcon(genBtn.createSpan("caud-btn-icon"), "volume-2");
		genBtn.createSpan({ text: "Generate", cls: "caud-btn-label" });
		const saveBtn = actions.createEl("button", { text: "Save to vault", cls: "caud-secondary-btn" });
		genBtn.onclick = () => void this.generate();
		saveBtn.onclick = () => void this.saveToVault();

		const playerCard = root.createDiv("caud-card caud-player-card");
		playerCard.createSpan({ cls: "caud-card-label", text: "Preview" });
		this.playerEl = playerCard.createDiv("caud-player");
		const emptyHint = this.playerEl.createDiv("caud-player-empty");
		setIcon(emptyHint.createSpan("caud-player-empty-icon"), "headphones");
		emptyHint.createSpan({ text: "Generated audio appears here", cls: "caud-player-empty-text" });

		this.unsubSwitcher = this.plugin.api.switcher.onChange((slot) => {
			if (slot === "tts") this.updateModelLabel();
		});
		this.onShow();
	}

	unmount(): void {
		this.unsubSwitcher?.();
		this.unsubSwitcher = null;
		if (this.lastAudioUrl) URL.revokeObjectURL(this.lastAudioUrl);
		this.lastAudioUrl = null;
		this.root?.empty();
		this.root = null;
	}

	onShow(): void {
		this.updateModelLabel();
		void this.refreshStatus();
	}

	private ttsUrl(): string {
		return this.plugin.api.serverUrl("tts");
	}

	private updateModelLabel(): void {
		if (!this.modelEl) return;
		this.modelEl.setText(this.plugin.api.switcher.activeModelName("tts"));
	}

	private setStatus(state: "ready" | "loading" | "offline", text: string): void {
		this.statusDotEl?.removeClass("is-ready", "is-loading", "is-offline");
		this.statusDotEl?.addClass(`is-${state}`);
		this.statusEl?.setText(text);
	}

	private async refreshStatus(): Promise<void> {
		try {
			const h = await this.plugin.api.tts.ping(this.ttsUrl());
			if (h.ready) this.setStatus("ready", "TTS ready");
			else this.setStatus("loading", h.error ? String(h.error) : "Not ready");
		} catch {
			this.setStatus("offline", "Offline");
		}
	}

	private async generate(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text) {
			new Notice("Enter text");
			return;
		}
		this.setStatus("loading", "Generating…");
		try {
			await this.plugin.api.switcher.activate("tts", this.plugin.api.switcher.getActiveModel("tts"), {
				ensureServer: true,
			});
			const buf = await this.plugin.api.tts.synthesize(text, this.ttsUrl());
			if (this.lastAudioUrl) URL.revokeObjectURL(this.lastAudioUrl);
			const blob = new Blob([buf], { type: "audio/wav" });
			this.lastAudioUrl = URL.createObjectURL(blob);
			this.playerEl.empty();
			this.playerEl.createEl("audio", { attr: { controls: "true", src: this.lastAudioUrl } });
			this.plugin.lastAudioBuffer = buf;
			await this.refreshStatus();
			new Notice("Audio ready");
		} catch (e) {
			new Notice(e instanceof Error ? e.message : String(e));
			await this.refreshStatus();
		}
	}

	private async saveToVault(): Promise<void> {
		const buf = this.plugin.lastAudioBuffer;
		if (!buf) {
			new Notice("Generate audio first");
			return;
		}
		const folder = this.plugin.settings.audio.outputFolder;
		await this.plugin.app.vault.createFolder(folder).catch(() => undefined);
		const name = `${folder}/tts-${Date.now()}.wav`;
		await this.plugin.app.vault.createBinary(name, buf);
		const md = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		md?.editor?.replaceSelection(`![[${name}]]\n`);
		new Notice(`Saved ${name}`);
	}
}
