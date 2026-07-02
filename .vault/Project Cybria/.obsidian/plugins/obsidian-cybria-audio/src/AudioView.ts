import { ItemView, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import type CybriaAudioPlugin from "./main";

export const VIEW_TYPE_CYBRIA_AUDIO = "cybria-audio-view";

export class AudioView extends ItemView {
	private plugin: CybriaAudioPlugin;
	private inputEl!: HTMLTextAreaElement;
	private statusEl!: HTMLElement;
	private playerEl!: HTMLElement;
	private terminalEl!: HTMLElement;
	private terminalLines: string[] = [];
	private lastAudioUrl: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: CybriaAudioPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CYBRIA_AUDIO;
	}

	getDisplayText(): string {
		return "Cybria Audio";
	}

	getIcon(): string {
		return "audio-lines";
	}

	setText(text: string): void {
		if (this.inputEl) this.inputEl.value = text;
	}

	private core() {
		return this.plugin.getCore();
	}

	private toolsDir(): string {
		return this.core().resolveToolsDir("tts", this.plugin.settings.toolsPath);
	}

	async onOpen(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("caud-root");

		const tabs = root.createDiv("caud-tabs");
		const speakTab = tabs.createEl("button", { text: "Speak", cls: "caud-tab is-active" });
		const serverTab = tabs.createEl("button", { text: "Server", cls: "caud-tab" });

		const speakPane = root.createDiv("caud-pane");
		const serverPane = root.createDiv("caud-pane caud-pane-hidden");

		this.statusEl = speakPane.createDiv("caud-status");
		this.inputEl = speakPane.createEl("textarea", {
			cls: "caud-textarea",
			attr: { placeholder: "Text to speak…", rows: "6" },
		});
		const actions = speakPane.createDiv("caud-actions");
		const genBtn = actions.createEl("button", { text: "Generate", cls: "mod-cta" });
		const saveBtn = actions.createEl("button", { text: "Save to vault" });
		this.playerEl = speakPane.createDiv("caud-player");
		genBtn.onclick = () => void this.generate();
		saveBtn.onclick = () => void this.saveToVault();

		this.buildServerPane(serverPane);

		speakTab.onclick = () => {
			speakTab.addClass("is-active");
			serverTab.removeClass("is-active");
			speakPane.removeClass("caud-pane-hidden");
			serverPane.addClass("caud-pane-hidden");
			this.plugin.settings.activeTab = "speak";
			void this.plugin.saveSettings();
		};
		serverTab.onclick = () => {
			serverTab.addClass("is-active");
			speakTab.removeClass("is-active");
			serverPane.removeClass("caud-pane-hidden");
			speakPane.addClass("caud-pane-hidden");
			this.plugin.settings.activeTab = "server";
			void this.plugin.saveSettings();
		};
		if (this.plugin.settings.activeTab === "server") serverTab.click();

		void this.refreshStatus();
	}

	private buildServerPane(el: HTMLElement): void {
		const card = el.createDiv("caud-card");
		const actions = card.createDiv("caud-actions");
		const runner = () => this.core().runner("tts");
		actions.createEl("button", { text: "Launch", cls: "mod-cta" }).onclick = () =>
			runner().launchServer(this.toolsDir(), (l) => this.log(l));
		actions.createEl("button", { text: "Stop" }).onclick = () =>
			runner().stopServer((l) => this.log(l));
		actions.createEl("button", { text: "Install deps" }).onclick = () =>
			void runner().installRequirements(this.toolsDir(), (l) => this.log(l));
		actions.createEl("button", { text: "Download model" }).onclick = () =>
			void this.core()
				.tts.downloadModel(this.plugin.settings.serverUrl)
				.then(() => new Notice("Download started"), (e) => new Notice(String(e)));
		actions.createEl("button", { text: "Load model" }).onclick = () =>
			void this.core()
				.tts.loadModel(this.plugin.settings.serverUrl)
				.then(() => new Notice("TTS model loading"), (e) => new Notice(String(e)));
		this.terminalEl = el.createDiv("caud-terminal");
		this.terminalEl.style.height = `${this.plugin.settings.terminalHeight}px`;
	}

	private log(line: string): void {
		this.terminalLines.push(line);
		if (this.terminalLines.length > 400) this.terminalLines.shift();
		if (this.terminalEl) {
			this.terminalEl.empty();
			for (const l of this.terminalLines) this.terminalEl.createDiv({ text: l });
			this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
		}
	}

	private async refreshStatus(): Promise<void> {
		try {
			const h = await this.core().tts.ping(this.plugin.settings.serverUrl);
			this.statusEl.setText(h.ready ? "TTS ready" : `Not ready${h.error ? `: ${h.error}` : ""}`);
		} catch {
			this.statusEl.setText("Server offline");
		}
	}

	private async generate(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text) {
			new Notice("Enter text");
			return;
		}
		this.statusEl.setText("Generating…");
		try {
			const buf = await this.core().tts.synthesize(text, this.plugin.settings.serverUrl);
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
		const folder = this.plugin.settings.outputFolder;
		await this.app.vault.createFolder(folder).catch(() => undefined);
		const name = `${folder}/tts-${Date.now()}.wav`;
		await this.app.vault.createBinary(name, buf);
		const md = this.app.workspace.getActiveViewOfType(MarkdownView);
		md?.editor?.replaceSelection(`![[${name}]]\n`);
		new Notice(`Saved ${name}`);
	}
}
