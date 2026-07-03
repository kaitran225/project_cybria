import { MarkdownView, Notice, setIcon } from "obsidian";
import type CybriaCorePlugin from "../../main";
import type { AppPane } from "../types";

export class NovelPane implements AppPane {
	private root: HTMLElement | null = null;
	private writeOutputEl!: HTMLElement;
	private summarizeOutputEl!: HTMLElement;
	private writeInputEl!: HTMLTextAreaElement;
	private summarizeInputEl!: HTMLTextAreaElement;
	private activePane: "write" | "summarize" = "write";

	constructor(private readonly plugin: CybriaCorePlugin) {}

	setWriteText(text: string): void {
		if (this.writeInputEl) this.writeInputEl.value = text;
		this.showSubTab("write");
	}

	setSummarizeText(text: string): void {
		if (this.summarizeInputEl) this.summarizeInputEl.value = text;
		this.showSubTab("summarize");
	}

	mount(root: HTMLElement): void {
		this.root = root;
		root.empty();
		root.addClass("cnv-root");

		const tabs = root.createDiv("cnv-tabs");
		const writeTab = tabs.createEl("button", { cls: "cnv-tab" });
		setIcon(writeTab.createSpan("cnv-tab-icon"), "pen-line");
		writeTab.createSpan({ text: "Write", cls: "cnv-tab-label" });
		const sumTab = tabs.createEl("button", { cls: "cnv-tab" });
		setIcon(sumTab.createSpan("cnv-tab-icon"), "file-text");
		sumTab.createSpan({ text: "Summarize", cls: "cnv-tab-label" });

		const writePane = root.createDiv("cnv-pane");
		const sumPane = root.createDiv("cnv-pane cnv-pane-hidden");
		this.buildWritePane(writePane);
		this.buildSummarizePane(sumPane);

		const show = (which: "write" | "summarize") => {
			this.activePane = which;
			[writeTab, sumTab].forEach((t) => t.removeClass("is-active"));
			[writePane, sumPane].forEach((p) => p.addClass("cnv-pane-hidden"));
			this.plugin.settings.novel.activeTab = which;
			void this.plugin.saveSettings();
			if (which === "write") {
				writeTab.addClass("is-active");
				writePane.removeClass("cnv-pane-hidden");
			} else {
				sumTab.addClass("is-active");
				sumPane.removeClass("cnv-pane-hidden");
			}
		};
		this.showSubTab = show;
		writeTab.onclick = () => show("write");
		sumTab.onclick = () => show("summarize");
		show(this.plugin.settings.novel.activeTab === "summarize" ? "summarize" : "write");
	}

	private showSubTab!: (which: "write" | "summarize") => void;

	unmount(): void {
		this.root?.empty();
		this.root = null;
	}

	onShow(): void {
		/* model shown in core header */
	}

	private buildWritePane(el: HTMLElement): void {
		this.writeInputEl = el.createEl("textarea", {
			cls: "cnv-textarea",
			attr: { placeholder: "Scene text or prompt…", rows: "6" },
		});
		const actions = el.createDiv("cnv-actions");
		const continueBtn = actions.createEl("button", { text: "Continue", cls: "mod-cta cnv-primary-btn" });
		const insertBtn = actions.createEl("button", { text: "Insert at cursor", cls: "cnv-secondary-btn" });
		const outCard = el.createDiv("cnv-card cnv-output-card");
		outCard.createSpan({ cls: "cnv-card-label", text: "Continuation" });
		this.writeOutputEl = outCard.createDiv("cnv-output");
		let lastOutput = "";
		continueBtn.onclick = () =>
			void this.runContinue().then((t) => {
				lastOutput = t;
			});
		insertBtn.onclick = () => {
			if (!lastOutput) {
				new Notice("Generate text first");
				return;
			}
			const md = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			md?.editor?.replaceSelection(lastOutput);
			if (!md?.editor) new Notice("Open a note to insert");
		};
	}

	private buildSummarizePane(el: HTMLElement): void {
		this.summarizeInputEl = el.createEl("textarea", {
			cls: "cnv-textarea",
			attr: { placeholder: "Text to summarize…", rows: "8" },
		});

		const actions = el.createDiv("cnv-actions");
		const sumBtn = actions.createEl("button", { text: "Summarize", cls: "mod-cta cnv-primary-btn" });
		const replaceBtn = actions.createEl("button", { text: "Replace selection", cls: "cnv-secondary-btn" });
		const saveBtn = actions.createEl("button", { text: "Save to file", cls: "cnv-secondary-btn" });
		const outCard = el.createDiv("cnv-card cnv-output-card");
		outCard.createSpan({ cls: "cnv-card-label", text: "Summary" });
		this.summarizeOutputEl = outCard.createDiv("cnv-output");
		sumBtn.onclick = () => void this.runSummarize();
		replaceBtn.onclick = () => this.replaceSelection();
		saveBtn.onclick = () => void this.saveSummary();
	}

	private async runContinue(): Promise<string> {
		const text = this.writeInputEl.value.trim();
		if (!text) {
			new Notice("Enter scene text");
			return "";
		}
		this.writeOutputEl.setText("Generating…");
		try {
			const api = this.plugin.api;
			const novelModel = api.switcher.getActiveModel("novel");
			const llmUrl = api.serviceUrl("llm");
			await api.ensureModelLoaded("novel");
			let full = "";
			for await (const chunk of api.llm.streamContinue(
				text,
				this.plugin.settings.novel.writePrompt,
				novelModel,
				llmUrl
			)) {
				full += chunk;
				this.writeOutputEl.setText(full);
			}
			return full;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.writeOutputEl.setText(`Error: ${msg}`);
			new Notice(msg);
			return "";
		}
	}

	private async runSummarize(): Promise<void> {
		const text = this.summarizeInputEl.value.trim();
		if (!text) {
			new Notice("Enter text to summarize");
			return;
		}
		this.summarizeOutputEl.setText("Summarizing…");
		try {
			const api = this.plugin.api;
			const sumUrl = api.serviceUrl("summarize");
			const h = await api.summarize.ping(sumUrl);
			if (!h.ready) throw new Error("Summarize server not ready — open Cybria AI → Servers");
			const summary = await api.summarize.summarize(
				text,
				api.switcher.getActiveModel("summarize"),
				sumUrl
			);
			this.summarizeOutputEl.setText(summary);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.summarizeOutputEl.setText(`Error: ${msg}`);
			new Notice(msg);
		}
	}

	private replaceSelection(): void {
		const text = this.summarizeOutputEl.getText();
		if (!text || text.startsWith("Error:")) return;
		const md = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (md?.editor) md.editor.replaceSelection(text);
		else new Notice("Open a note with a selection");
	}

	private async saveSummary(): Promise<void> {
		const text = this.summarizeOutputEl.getText();
		if (!text || text.startsWith("Error:")) {
			new Notice("Nothing to save");
			return;
		}
		const folder = this.plugin.settings.novel.summariesFolder;
		const name = `${folder}/Summary ${new Date().toISOString().slice(0, 10)}.md`;
		await this.plugin.app.vault.createFolder(folder).catch(() => undefined);
		const file = await this.plugin.app.vault.create(name, text);
		new Notice(`Saved ${file.path}`);
	}
}
