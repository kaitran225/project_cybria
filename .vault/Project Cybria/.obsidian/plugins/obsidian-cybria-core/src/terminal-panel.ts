import { setIcon } from "obsidian";
import { renderTerminalLine } from "./terminal-ansi";
import type CybriaCorePlugin from "./main";

export class TerminalPanel {
	private terminalEl!: HTMLElement;
	private unsubLog: (() => void) | null = null;
	private terminalRendered = 0;

	constructor(private readonly plugin: CybriaCorePlugin) {}

	build(host: HTMLElement): HTMLElement {
		const block = host.createDiv("ccore-terminal-block");
		const termHead = block.createDiv("ccore-terminal-head");
		const termTitle = termHead.createDiv("ccore-terminal-title-wrap");
		setIcon(termTitle.createSpan("ccore-terminal-icon"), "terminal");
		termTitle.createSpan({ text: "Terminal", cls: "ccore-terminal-title" });
		termHead.createEl("button", { text: "Clear", cls: "ccore-secondary-btn" }).onclick = () => {
			this.plugin.api.log.clear();
			this.render();
		};
		this.terminalEl = block.createDiv("ccore-terminal");
		this.unsubLog = this.plugin.api.log.onLine(() => this.appendLine());
		this.render();
		return block;
	}

	unmount(): void {
		this.unsubLog?.();
		this.unsubLog = null;
	}

	private appendLine(): void {
		if (!this.terminalEl) return;
		const lines = this.plugin.api.log.getLines();
		while (this.terminalRendered < lines.length) {
			const line = lines[this.terminalRendered]!;
			this.terminalRendered++;
			renderTerminalLine(this.terminalEl, line);
		}
		this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
	}

	render(): void {
		if (!this.terminalEl) return;
		this.terminalEl.empty();
		this.terminalRendered = 0;
		this.appendLine();
	}
}
