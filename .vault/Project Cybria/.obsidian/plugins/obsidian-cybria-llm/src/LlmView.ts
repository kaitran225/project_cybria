import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type CybriaLlmPlugin from "./main";
import type { ChatMessage } from "./require-core";
import { CHAT_MODELS } from "./settings";
export const VIEW_TYPE_CYBRIA_LLM = "cybria-llm-view";

export class LlmView extends ItemView {
	private plugin: CybriaLlmPlugin;
	private messages: ChatMessage[] = [];
	private chatEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private statusEl!: HTMLElement;
	private terminalEl!: HTMLElement;
	private terminalLines: string[] = [];
	private abortController: AbortController | null = null;
	private streaming = false;

	constructor(leaf: WorkspaceLeaf, plugin: CybriaLlmPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CYBRIA_LLM;
	}

	getDisplayText(): string {
		return "Cybria LLM";
	}

	getIcon(): string {
		return "bot";
	}

	setInput(text: string): void {
		if (this.inputEl) this.inputEl.value = text;
	}

	private core() {
		return this.plugin.getCore();
	}

	private toolsDir(): string {
		return this.core().resolveToolsDir("llm", this.plugin.settings.toolsPath);
	}

	async onOpen(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("cllm-root");

		const tabs = root.createDiv("cllm-tabs");
		const chatTab = tabs.createEl("button", { text: "Chat", cls: "cllm-tab" });
		const serverTab = tabs.createEl("button", { text: "Server", cls: "cllm-tab" });
		if (this.plugin.settings.activeTab === "server") serverTab.addClass("is-active");
		else chatTab.addClass("is-active");

		const chatPane = root.createDiv("cllm-pane");
		const serverPane = root.createDiv("cllm-pane cllm-pane-hidden");

		this.buildChatPane(chatPane);
		this.buildServerPane(serverPane);

		const showChat = () => {
			chatTab.addClass("is-active");
			serverTab.removeClass("is-active");
			chatPane.removeClass("cllm-pane-hidden");
			serverPane.addClass("cllm-pane-hidden");
			this.plugin.settings.activeTab = "chat";
			void this.plugin.saveSettings();
		};
		const showServer = () => {
			serverTab.addClass("is-active");
			chatTab.removeClass("is-active");
			serverPane.removeClass("cllm-pane-hidden");
			chatPane.addClass("cllm-pane-hidden");
			this.plugin.settings.activeTab = "server";
			void this.plugin.saveSettings();
		};
		chatTab.onclick = showChat;
		serverTab.onclick = showServer;
		if (this.plugin.settings.activeTab === "server") showServer();

		void this.refreshHealth();
	}

	private activeModelId(): string {
		return this.core().switcher.getActiveModel("llm");
	}

	private buildChatPane(el: HTMLElement): void {
		this.statusEl = el.createDiv("cllm-status");
		const modelRow = el.createDiv("cllm-model-row");
		const models = this.core().switcher.listModels("llm");
		for (const m of models.length ? models : CHAT_MODELS.map((x) => ({ ...x, runnable: "yes" }))) {
			const btn = modelRow.createEl("button", {
				text: m.name,
				cls: "cllm-model-pill",
			});
			if (m.id === this.activeModelId()) btn.addClass("is-active");
			btn.onclick = () => {
				void this.core()
					.switcher.activate("llm", m.id, {
						ensureServer: true,
						onLog: (l) => this.logTerminal(l),
					})
					.then(() => {
						this.plugin.settings.modelId = m.id;
						void this.plugin.saveSettings();
						modelRow.querySelectorAll(".cllm-model-pill").forEach((p) => p.removeClass("is-active"));
						btn.addClass("is-active");
						void this.refreshHealth();
					})
					.catch((e) => new Notice(e instanceof Error ? e.message : String(e)));
			};
		}

		this.chatEl = el.createDiv("cllm-chat");
		const inputRow = el.createDiv("cllm-input-row");
		this.inputEl = inputRow.createEl("textarea", {
			cls: "cllm-input",
			attr: { placeholder: "Message…", rows: "3" },
		});
		const sendBtn = inputRow.createEl("button", { text: "Send", cls: "mod-cta" });
		sendBtn.onclick = () => void this.sendMessage();
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void this.sendMessage();
			}
		});
	}

	private buildServerPane(el: HTMLElement): void {
		const card = el.createDiv("cllm-card");
		const actions = card.createDiv("cllm-actions");
		const runner = () => this.core().runner("llm");
		actions.createEl("button", { text: "Launch", cls: "mod-cta" }).onclick = () =>
			runner().launchServer(this.toolsDir(), (l) => this.logTerminal(l));
		actions.createEl("button", { text: "Stop" }).onclick = () =>
			runner().stopServer((l) => this.logTerminal(l));
		actions.createEl("button", { text: "Install deps" }).onclick = () => void this.installDeps();
		actions.createEl("button", { text: "Check env" }).onclick = () => void this.checkEnv();
		actions.createEl("button", { text: "Download model" }).onclick = () => void this.downloadCurrentModel();

		this.terminalEl = el.createDiv("cllm-terminal");
		this.terminalEl.style.height = `${this.plugin.settings.terminalHeight}px`;
		this.renderTerminal();
	}

	private logTerminal(line: string): void {
		this.terminalLines.push(line);
		if (this.terminalLines.length > 500) this.terminalLines.shift();
		this.renderTerminal();
	}

	private renderTerminal(): void {
		if (!this.terminalEl) return;
		this.terminalEl.empty();
		for (const line of this.terminalLines) {
			this.terminalEl.createDiv({ text: line, cls: "cllm-terminal-line" });
		}
		this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
	}

	private async installDeps(): Promise<void> {
		try {
			await this.core().runner("llm").installRequirements(this.toolsDir(), (l) => this.logTerminal(l));
			new Notice("Dependencies installed");
		} catch (e) {
			new Notice(`Install failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async checkEnv(): Promise<void> {
		try {
			const r = await this.core().runner("llm").checkRequirements(this.toolsDir(), (l) => this.logTerminal(l));
			new Notice(r.ok ? "Environment OK" : `Issues: ${r.errors.join(", ")}`);
		} catch (e) {
			new Notice(`Check failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async downloadCurrentModel(): Promise<void> {
		try {
			await this.core()
				.runner("llm")
				.downloadModel(this.toolsDir(), this.activeModelId(), (l) => this.logTerminal(l));
			new Notice("Model download complete");
		} catch (e) {
			new Notice(`Download failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async refreshHealth(): Promise<void> {
		try {
			const h = await this.core().llm.ping(this.plugin.settings.serverUrl);
			this.statusEl.setText(
				h.ready
					? `Ready — ${h.model_id ?? "model loaded"}`
					: h.loading
						? "Loading model…"
						: `Not ready${h.error ? `: ${h.error}` : ""}`
			);
		} catch {
			this.statusEl.setText("Server offline — launch from Server tab");
		}
	}

	private async ensureModelLoaded(modelId: string): Promise<void> {
		try {
			await this.core().llm.loadModel(modelId, this.plugin.settings.serverUrl);
			await this.refreshHealth();
		} catch (e) {
			new Notice(`Load model: ${e instanceof Error ? e.message : e}`);
		}
	}

	private appendBubble(role: "user" | "assistant", content: string): HTMLElement {
		const bubble = this.chatEl.createDiv(`cllm-bubble cllm-bubble-${role}`);
		bubble.setText(content);
		this.chatEl.scrollTop = this.chatEl.scrollHeight;
		return bubble;
	}

	private async sendMessage(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text || this.streaming) return;
		this.inputEl.value = "";
		this.messages.push({ role: "user", content: text });
		this.appendBubble("user", text);
		const assistantBubble = this.appendBubble("assistant", "");
		this.streaming = true;
		this.abortController = new AbortController();

		let full = "";
		try {
			await this.ensureModelLoaded(this.activeModelId());
			const core = this.core();
			for await (const chunk of core.llm.streamChat(
				this.messages,
				{
					model: this.activeModelId(),
					temperature: this.plugin.settings.temperature,
					maxTokens: this.plugin.settings.maxTokens,
					systemPrompt: this.plugin.settings.systemPrompt,
				},
				this.plugin.settings.serverUrl,
				this.abortController.signal
			)) {
				full += chunk;
				assistantBubble.setText(full);
				this.chatEl.scrollTop = this.chatEl.scrollHeight;
			}
			this.messages.push({ role: "assistant", content: full });
			await this.refreshHealth();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			assistantBubble.setText(`Error: ${msg}`);
			new Notice(msg);
		} finally {
			this.streaming = false;
			this.abortController = null;
		}
	}

	async onClose(): Promise<void> {
		this.abortController?.abort();
	}
}
