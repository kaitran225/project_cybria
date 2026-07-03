import { MarkdownView, Notice, setIcon } from "obsidian";
import type CybriaCorePlugin from "../../main";
import type { AppPane } from "../types";

export class AudioPane implements AppPane {
	private root: HTMLElement | null = null;
	private inputEl!: HTMLTextAreaElement;
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

		this.unsubSwitcher = this.plugin.api.switcher.onChange(() => {
			void this.refreshStatus();
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
		void this.refreshStatus();
	}

	private ttsUrl(): string {
		return this.plugin.api.serviceUrl("tts");
	}

	private setStatus(state: "ready" | "loading" | "offline", text: string): void {
		this.plugin.getSwitcherView()?.setPaneStatus(text, state);
	}

	private async refreshStatus(): Promise<void> {
		const model = this.plugin.api.switcher.activeModelName("tts");
		try {
			const h = await this.plugin.api.tts.ping(this.ttsUrl());
			if (h.ready) this.setStatus("ready", `${model} · Ready`);
			else this.setStatus("loading", h.error ? String(h.error) : `${model} · Not ready`);
		} catch {
			this.setStatus("offline", `${model} · Offline`);
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
