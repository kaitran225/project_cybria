import { Notice, setIcon } from "obsidian";
import type { ChatMessage } from "../../clients/llm";
import type CybriaCorePlugin from "../../main";
import type { AppPane } from "../types";

export class LlmPane implements AppPane {
	private root: HTMLElement | null = null;
	private messages: ChatMessage[] = [];
	private chatEl!: HTMLElement;
	private emptyEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private stopBtn!: HTMLButtonElement;
	private abortController: AbortController | null = null;
	private streaming = false;
	private unsubSwitcher: (() => void) | null = null;

	constructor(private readonly plugin: CybriaCorePlugin) {}

	setInput(text: string): void {
		if (this.inputEl) this.inputEl.value = text;
	}

	mount(root: HTMLElement): void {
		this.root = root;
		root.empty();
		root.addClass("cllm-root");

		const chatWrap = root.createDiv("cllm-chat-wrap");
		this.chatEl = chatWrap.createDiv("cllm-chat");
		this.emptyEl = chatWrap.createDiv("cllm-empty");
		this.emptyEl.createDiv("cllm-empty-icon");
		setIcon(this.emptyEl.querySelector(".cllm-empty-icon") as HTMLElement, "message-square");
		this.emptyEl.createEl("p", { text: "Start a conversation" });
		this.emptyEl.createEl("span", { text: "Ctrl+Enter to send", cls: "cllm-empty-hint" });

		const composer = root.createDiv("cllm-composer");
		this.inputEl = composer.createEl("textarea", {
			cls: "cllm-input",
			attr: { placeholder: "Message…", rows: "1" },
		});
		const btnRow = composer.createDiv("cllm-composer-actions");
		const clearBtn = btnRow.createEl("button", {
			cls: "cllm-icon-btn cllm-clear-btn",
			attr: { "aria-label": "Clear chat" },
		});
		setIcon(clearBtn, "trash-2");
		clearBtn.onclick = () => this.clearChat();
		this.stopBtn = btnRow.createEl("button", { cls: "cllm-stop-btn", text: "Stop" });
		this.stopBtn.addClass("is-hidden");
		this.stopBtn.onclick = () => this.abortController?.abort();
		this.sendBtn = btnRow.createEl("button", { cls: "cllm-send-btn mod-cta" });
		setIcon(this.sendBtn.createSpan("cllm-send-icon"), "arrow-up");
		this.sendBtn.onclick = () => void this.sendMessage();

		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void this.sendMessage();
			}
		});
		this.inputEl.addEventListener("input", () => this.autoResizeInput());

		this.unsubSwitcher = this.plugin.api.switcher.onChange((slot) => {
			if (slot === "llm") void this.refreshHealth();
		});
		this.onShow();
	}

	unmount(): void {
		this.abortController?.abort();
		this.unsubSwitcher?.();
		this.unsubSwitcher = null;
		this.root?.empty();
		this.root = null;
	}

	onShow(): void {
		void this.refreshHealth();
	}

	private llmUrl(): string {
		return this.plugin.api.serviceUrl("llm");
	}

	private activeModelId(): string {
		return this.plugin.api.switcher.getActiveModel("llm");
	}

	private autoResizeInput(): void {
		if (!this.inputEl) return;
		this.inputEl.style.height = "auto";
		this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 140)}px`;
	}

	private syncEmptyState(): void {
		const empty = this.messages.length === 0;
		this.emptyEl?.toggleClass("is-hidden", !empty);
		this.chatEl?.toggleClass("is-hidden", empty);
	}

	private clearChat(): void {
		if (this.streaming) return;
		this.messages = [];
		this.chatEl?.empty();
		this.syncEmptyState();
	}

	private setStreaming(on: boolean): void {
		this.streaming = on;
		this.sendBtn?.toggleClass("is-hidden", on);
		this.stopBtn?.toggleClass("is-hidden", !on);
		if (this.inputEl) this.inputEl.disabled = on;
	}

	private async refreshHealth(): Promise<void> {
		const view = this.plugin.getSwitcherView();
		const model = this.plugin.api.switcher.activeModelName("llm");
		try {
			const h = await this.plugin.api.llm.ping(this.llmUrl());
			if (h.ready) view?.setPaneStatus(`${model} · Ready`, "ready");
			else if (h.loading) view?.setPaneStatus(`${model} · Loading…`, "loading");
			else view?.setPaneStatus(h.error ? String(h.error) : `${model} · Not ready`, "offline");
		} catch {
			view?.setPaneStatus(`${model} · Offline`, "offline");
		}
	}

	private appendBubble(role: "user" | "assistant", content: string): HTMLElement {
		const row = this.chatEl.createDiv(`cllm-msg cllm-msg-${role}`);
		const bubble = row.createDiv("cllm-bubble");
		bubble.setText(content || (role === "assistant" ? "…" : ""));
		if (role === "assistant" && !content) bubble.addClass("is-typing");
		this.syncEmptyState();
		this.chatEl.scrollTop = this.chatEl.scrollHeight;
		return bubble;
	}

	private async sendMessage(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text || this.streaming) return;
		this.inputEl.value = "";
		this.autoResizeInput();
		this.messages.push({ role: "user", content: text });
		this.appendBubble("user", text);
		const assistantBubble = this.appendBubble("assistant", "");
		this.setStreaming(true);
		this.abortController = new AbortController();
		const s = this.plugin.settings.llm;
		let full = "";
		try {
			await this.plugin.api.ensureModelLoaded("llm");
			for await (const chunk of this.plugin.api.llm.streamChat(
				this.messages,
				{
					model: this.activeModelId(),
					temperature: s.temperature,
					maxTokens: s.maxTokens,
					systemPrompt: s.systemPrompt,
				},
				this.llmUrl(),
				this.abortController.signal
			)) {
				full += chunk;
				assistantBubble.removeClass("is-typing");
				assistantBubble.setText(full);
				this.chatEl.scrollTop = this.chatEl.scrollHeight;
			}
			this.messages.push({ role: "assistant", content: full });
			await this.refreshHealth();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			assistantBubble.removeClass("is-typing");
			assistantBubble.addClass("is-error");
			assistantBubble.setText(msg.startsWith("Error:") ? msg : `Error: ${msg}`);
			new Notice(msg);
		} finally {
			this.setStreaming(false);
			this.abortController = null;
		}
	}
}
