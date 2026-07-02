import { ItemView, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import type CybriaNovelPlugin from "./main";

export const VIEW_TYPE_CYBRIA_NOVEL = "cybria-novel-view";

export class NovelView extends ItemView {
	private plugin: CybriaNovelPlugin;
	private terminalLines: string[] = [];
	private terminalEl!: HTMLElement;
	private writeOutputEl!: HTMLElement;
	private summarizeOutputEl!: HTMLElement;
	private writeInputEl!: HTMLTextAreaElement;
	private summarizeInputEl!: HTMLTextAreaElement;

	constructor(leaf: WorkspaceLeaf, plugin: CybriaNovelPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CYBRIA_NOVEL;
	}

	getDisplayText(): string {
		return "Cybria Novel";
	}

	getIcon(): string {
		return "book-open";
	}

	setWriteText(text: string): void {
		if (this.writeInputEl) this.writeInputEl.value = text;
	}

	setSummarizeText(text: string): void {
		if (this.summarizeInputEl) this.summarizeInputEl.value = text;
	}

	private core() {
		return this.plugin.getCore();
	}

	async onOpen(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("cnv-root");

		const tabs = root.createDiv("cnv-tabs");
		const writeTab = tabs.createEl("button", { text: "Write", cls: "cnv-tab" });
		const sumTab = tabs.createEl("button", { text: "Summarize", cls: "cnv-tab" });
		const serverTab = tabs.createEl("button", { text: "Server", cls: "cnv-tab" });

		const writePane = root.createDiv("cnv-pane");
		const sumPane = root.createDiv("cnv-pane cnv-pane-hidden");
		const serverPane = root.createDiv("cnv-pane cnv-pane-hidden");

		this.buildWritePane(writePane);
		this.buildSummarizePane(sumPane);
		this.buildServerPane(serverPane);

		const show = (which: "write" | "summarize" | "server") => {
			[writeTab, sumTab, serverTab].forEach((t) => t.removeClass("is-active"));
			[writePane, sumPane, serverPane].forEach((p) => p.addClass("cnv-pane-hidden"));
			this.plugin.settings.activeTab = which;
			void this.plugin.saveSettings();
			if (which === "write") {
				writeTab.addClass("is-active");
				writePane.removeClass("cnv-pane-hidden");
			} else if (which === "summarize") {
				sumTab.addClass("is-active");
				sumPane.removeClass("cnv-pane-hidden");
			} else {
				serverTab.addClass("is-active");
				serverPane.removeClass("cnv-pane-hidden");
			}
		};
		writeTab.onclick = () => show("write");
		sumTab.onclick = () => show("summarize");
		serverTab.onclick = () => show("server");
		show(this.plugin.settings.activeTab);
	}

	private buildWritePane(el: HTMLElement): void {
		const modelRow = el.createDiv("cnv-model-row");
		const models = this.core().switcher.listModels("novel");
		for (const m of models) {
			const btn = modelRow.createEl("button", { text: m.name, cls: "cnv-pill" });
			if (m.id === this.core().switcher.getActiveModel("novel")) btn.addClass("is-active");
			btn.onclick = () => {
				void this.core()
					.switcher.activate("novel", m.id, { ensureServer: true, onLog: (l) => this.log(l) })
					.then(() => {
						modelRow.querySelectorAll(".cnv-pill").forEach((p) => p.removeClass("is-active"));
						btn.addClass("is-active");
					})
					.catch((e) => new Notice(e instanceof Error ? e.message : String(e)));
			};
		}
		this.writeInputEl = el.createEl("textarea", {
			cls: "cnv-textarea",
			attr: { placeholder: "Scene text or prompt…", rows: "6" },
		});
		const actions = el.createDiv("cnv-actions");
		const continueBtn = actions.createEl("button", { text: "Continue", cls: "mod-cta" });
		const insertBtn = actions.createEl("button", { text: "Insert at cursor" });
		this.writeOutputEl = el.createDiv("cnv-output");
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
			const md = this.app.workspace.getActiveViewOfType(MarkdownView);
			md?.editor?.replaceSelection(lastOutput);
			if (!md?.editor) new Notice("Open a note to insert");
		};
	}

	private buildSummarizePane(el: HTMLElement): void {
		const modelRow = el.createDiv("cnv-model-row");
		const models = this.core().switcher.listModels("summarize");
		for (const m of models) {
			const btn = modelRow.createEl("button", { text: m.name, cls: "cnv-pill" });
			if (m.id === this.core().switcher.getActiveModel("summarize")) btn.addClass("is-active");
			btn.onclick = () => {
				void this.core()
					.switcher.activate("summarize", m.id, { ensureServer: true, onLog: (l) => this.log(l) })
					.then(() => {
						modelRow.querySelectorAll(".cnv-pill").forEach((p) => p.removeClass("is-active"));
						btn.addClass("is-active");
					})
					.catch((e) => new Notice(e instanceof Error ? e.message : String(e)));
			};
		}
		this.summarizeInputEl = el.createEl("textarea", {
			cls: "cnv-textarea",
			attr: { placeholder: "Text to summarize…", rows: "8" },
		});
		const actions = el.createDiv("cnv-actions");
		const sumBtn = actions.createEl("button", { text: "Summarize", cls: "mod-cta" });
		const replaceBtn = actions.createEl("button", { text: "Replace selection" });
		const saveBtn = actions.createEl("button", { text: "Save to file" });
		this.summarizeOutputEl = el.createDiv("cnv-output");
		sumBtn.onclick = () => void this.runSummarize();
		replaceBtn.onclick = () => this.replaceSelection();
		saveBtn.onclick = () => void this.saveSummary();
	}

	private buildServerPane(el: HTMLElement): void {
		const llmCard = el.createDiv("cnv-card");
		llmCard.createEl("h4", { text: "LLM (cybria-llm :8790)" });
		const llmActions = llmCard.createDiv("cnv-actions");
		llmActions.createEl("button", { text: "Launch LLM" }).onclick = () =>
			this.core().runner("llm").launchServer(this.llmDir(), (l) => this.log(l));
		llmActions.createEl("button", { text: "Stop LLM" }).onclick = () =>
			this.core().runner("llm").stopServer((l) => this.log(l));
		llmActions.createEl("button", { text: "Install LLM deps" }).onclick = () =>
			void this.core().runner("llm").installRequirements(this.llmDir(), (l) => this.log(l));

		const sumCard = el.createDiv("cnv-card");
		sumCard.createEl("h4", { text: "Summarize (cybria-summarize :8791)" });
		const sumActions = sumCard.createDiv("cnv-actions");
		sumActions.createEl("button", { text: "Launch Summarize" }).onclick = () =>
			this.core().runner("summarize").launchServer(this.sumDir(), (l) => this.log(l));
		sumActions.createEl("button", { text: "Stop Summarize" }).onclick = () =>
			this.core().runner("summarize").stopServer((l) => this.log(l));
		sumActions.createEl("button", { text: "Install Sum deps" }).onclick = () =>
			void this.core().runner("summarize").installRequirements(this.sumDir(), (l) => this.log(l));
		sumActions.createEl("button", { text: "Download sum model" }).onclick = () =>
			void this.core()
				.summarize.downloadModel(
					this.core().switcher.getActiveModel("summarize"),
					this.plugin.settings.summarizeServerUrl
				)
				.then(
					() => new Notice("Download started on server"),
					(e) => new Notice(String(e))
				);

		this.terminalEl = el.createDiv("cnv-terminal");
		this.terminalEl.style.height = `${this.plugin.settings.terminalHeight}px`;
	}

	private llmDir(): string {
		return this.core().resolveToolsDir("llm", this.plugin.settings.llmToolsPath);
	}

	private sumDir(): string {
		return this.core().resolveToolsDir("summarize", this.plugin.settings.summarizeToolsPath);
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

	private async runContinue(): Promise<string> {
		const text = this.writeInputEl.value.trim();
		if (!text) {
			new Notice("Enter scene text");
			return "";
		}
		this.writeOutputEl.setText("Generating…");
		try {
			const core = this.core();
			const novelModel = core.switcher.getActiveModel("novel");
			await core.llm.loadModel(novelModel, this.plugin.settings.llmServerUrl);
			let full = "";
			for await (const chunk of core.llm.streamContinue(
				text,
				this.plugin.settings.writePrompt,
				novelModel,
				this.plugin.settings.llmServerUrl
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
			const core = this.core();
			const h = await core.summarize.ping(this.plugin.settings.summarizeServerUrl);
			if (!h.ready) throw new Error("Summarize server not ready");
			const sumModel = core.switcher.getActiveModel("summarize");
			const summary = await core.summarize.summarize(
				text,
				sumModel,
				this.plugin.settings.summarizeServerUrl
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
		const md = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (md?.editor) md.editor.replaceSelection(text);
		else new Notice("Open a note with a selection");
	}

	private async saveSummary(): Promise<void> {
		const text = this.summarizeOutputEl.getText();
		if (!text || text.startsWith("Error:")) {
			new Notice("Nothing to save");
			return;
		}
		const folder = this.plugin.settings.summariesFolder;
		const name = `${folder}/Summary ${new Date().toISOString().slice(0, 10)}.md`;
		await this.app.vault.createFolder(folder).catch(() => undefined);
		const file = await this.app.vault.create(name, text);
		new Notice(`Saved ${file.path}`);
	}
}
