import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { pingServer } from "./client";
import {
	ImageServerRunner,
	type ReqCheckResult,
} from "./server-launcher";
import { DEFAULT_MODEL_LABEL } from "./settings";
import type ImageGenPlugin from "./main";

export const VIEW_TYPE_IMAGE_GEN = "image-gen-view";

const MIN_TERMINAL = 100;
const MAX_TERMINAL_RATIO = 0.7;

type TabId = "server" | "generate";

export class ImageGenView extends ItemView {
	private prompt = "";
	private busy = false;
	private healthTimer = 0;
	private progressTimer = 0;
	private activeTab: TabId = "generate";
	private logEl!: HTMLElement;
	private footerEl!: HTMLElement;
	private statusBarEl!: HTMLElement;
	private serverTabEl!: HTMLElement;
	private generateTabEl!: HTMLElement;
	private tabServerBtn!: HTMLButtonElement;
	private tabGenBtn!: HTMLButtonElement;
	private genServerPill!: HTMLElement;
	private previewEl!: HTMLElement;
	private galleryEl!: HTMLElement;
	private genStatusEl!: HTMLElement;
	private promptArea!: HTMLTextAreaElement;
	private progressWrap!: HTMLElement;
	private progressFill!: HTMLElement;
	private progressLabel!: HTMLElement;
	private modelEl!: HTMLElement;
	private reqEl!: HTMLElement;
	private genParamsEl!: HTMLElement;
	private lastReq: ReqCheckResult | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: ImageGenPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_IMAGE_GEN;
	}

	getDisplayText(): string {
		return "Image Gen";
	}

	getIcon(): string {
		return "image";
	}

	setPrompt(text: string): void {
		this.prompt = text;
		if (this.promptArea) this.promptArea.value = text;
		this.switchTab("generate");
	}

	async onOpen(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("image-gen-view");
		this.activeTab = this.plugin.settings.activeTab ?? "generate";

		const tabBar = containerEl.createDiv({ cls: "image-gen-tabs" });
		this.tabServerBtn = tabBar.createEl("button", {
			cls: "image-gen-tab",
			text: "Server",
		});
		this.tabGenBtn = tabBar.createEl("button", {
			cls: "image-gen-tab",
			text: "Generate",
		});
		this.tabServerBtn.onclick = () => this.switchTab("server");
		this.tabGenBtn.onclick = () => this.switchTab("generate");

		const content = containerEl.createDiv({ cls: "image-gen-tab-content" });

		// --- Server tab ---
		this.serverTabEl = content.createDiv({ cls: "image-gen-tab-panel image-gen-tab-server" });

		const serverTop = this.serverTabEl.createDiv({ cls: "image-gen-server-top" });
		this.modelEl = serverTop.createDiv({ cls: "image-gen-kv image-gen-model" });
		this.reqEl = serverTop.createDiv({ cls: "image-gen-req" });

		const serverBtns = serverTop.createDiv({ cls: "image-gen-btn-grid" });
		serverBtns.createEl("button", { text: "Check Python" }).onclick = () =>
			void this.onCheckRequirements();
		serverBtns.createEl("button", { text: "Install deps" }).onclick = () =>
			void this.onInstallRequirements();
		const launchBtn = serverBtns.createEl("button", { text: "Launch" });
		launchBtn.addClass("mod-cta");
		launchBtn.onclick = () => void this.onLaunchServer();
		serverBtns.createEl("button", { text: "Stop" }).onclick = () => this.onStopServer();
		serverBtns.createEl("button", { text: "Health" }).onclick = () =>
			void this.checkHealth(true);

		this.footerEl = this.serverTabEl.createDiv({ cls: "image-gen-footer" });
		this.footerEl.style.height = `${this.plugin.settings.terminalHeight}px`;

		const resizeHandle = this.footerEl.createDiv({ cls: "image-gen-resize-handle" });
		resizeHandle.setAttr("title", "Drag to resize terminal");
		this.setupResize(resizeHandle);

		this.statusBarEl = this.footerEl.createDiv({ cls: "image-gen-status-bar" });
		this.statusBarEl.setText("Server status: unknown");

		this.logEl = this.footerEl.createDiv({ cls: "image-gen-terminal" });

		// --- Generate tab ---
		this.generateTabEl = content.createDiv({
			cls: "image-gen-tab-panel image-gen-tab-generate",
		});

		const genScroll = this.generateTabEl.createDiv({ cls: "image-gen-gen-scroll" });

		this.genServerPill = genScroll.createDiv({ cls: "image-gen-server-pill" });
		this.genServerPill.setText("Server: checking…");

		this.genParamsEl = genScroll.createDiv({ cls: "image-gen-gen-params" });

		this.promptArea = genScroll.createEl("textarea", {
			cls: "image-gen-prompt",
			attr: { placeholder: "Describe the image…", rows: "5" },
		});
		this.promptArea.oninput = () => {
			this.prompt = this.promptArea.value;
		};

		this.progressWrap = genScroll.createDiv({ cls: "image-gen-progress is-hidden" });
		this.progressLabel = this.progressWrap.createDiv({
			cls: "image-gen-progress-label",
			text: "Generating…",
		});
		const track = this.progressWrap.createDiv({ cls: "image-gen-progress-track" });
		this.progressFill = track.createDiv({ cls: "image-gen-progress-fill" });

		const genBtn = genScroll.createEl("button", { text: "Generate", cls: "image-gen-gen-btn" });
		genBtn.addClass("mod-cta");
		genBtn.onclick = () => void this.onGenerate(genBtn);
		this.genStatusEl = genScroll.createDiv({ cls: "image-gen-status" });

		genScroll.createEl("h4", { text: "Output" });
		this.previewEl = genScroll.createDiv({ cls: "image-gen-preview" });
		this.galleryEl = genScroll.createDiv({ cls: "image-gen-gallery" });

		this.renderConfigDisplay();
		this.renderReqStatus(null);
		this.renderGenParams();
		this.switchTab(this.activeTab, false);

		this.appendShell("# server shell — pip / python output");
		void this.onCheckRequirements(false);
		void this.checkHealth(true);
		this.healthTimer = window.setInterval(() => void this.checkHealth(false), 8000);
		this.renderOutput();
	}

	async onClose(): Promise<void> {
		window.clearInterval(this.healthTimer);
		this.stopProgress(false);
		this.containerEl.empty();
	}

	private switchTab(tab: TabId, save = true): void {
		this.activeTab = tab;
		this.serverTabEl.toggleClass("is-active", tab === "server");
		this.generateTabEl.toggleClass("is-active", tab === "generate");
		this.tabServerBtn.toggleClass("is-active", tab === "server");
		this.tabGenBtn.toggleClass("is-active", tab === "generate");
		if (save) {
			this.plugin.settings.activeTab = tab;
			void this.plugin.saveSettings();
		}
	}

	appendShell(line: string): void {
		if (!this.logEl) return;
		const row = this.logEl.createDiv({ cls: "image-gen-shell-line" });
		row.setText(line);
		this.logEl.scrollTop = this.logEl.scrollHeight;
	}

	private setupResize(handle: HTMLElement): void {
		let startY = 0;
		let startH = 0;

		const onMove = (ev: MouseEvent) => {
			const maxH = this.serverTabEl.clientHeight * MAX_TERMINAL_RATIO;
			const next = Math.min(maxH, Math.max(MIN_TERMINAL, startH - (ev.clientY - startY)));
			this.footerEl.style.height = `${next}px`;
		};

		const onUp = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			const h = parseInt(this.footerEl.style.height, 10);
			if (!Number.isNaN(h)) {
				this.plugin.settings.terminalHeight = h;
				void this.plugin.saveSettings();
			}
		};

		handle.onmousedown = (e: MouseEvent) => {
			e.preventDefault();
			startY = e.clientY;
			startH = this.footerEl.offsetHeight;
			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		};
	}

	private vaultPath(): string {
		return (this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? "";
	}

	private toolsDir(): string {
		const base = this.vaultPath();
		return this.plugin.serverRunner.resolveToolsDir(
			base,
			this.plugin.settings.qwenToolsPath
		);
	}

	private renderConfigDisplay(modelOverride?: string): void {
		const model = modelOverride ?? this.lastReq?.model ?? DEFAULT_MODEL_LABEL;
		this.modelEl.setText(model);
	}

	private renderGenParams(): void {
		const s = this.plugin.settings;
		this.genParamsEl.empty();
		const grid = this.genParamsEl.createDiv({ cls: "image-gen-param-grid" });
		const items = [
			`${s.width}×${s.height}`,
			`${s.steps} steps`,
			`CFG ${s.cfg}`,
			s.seed.trim() ? `seed ${s.seed}` : "random seed",
		];
		for (const item of items) {
			grid.createSpan({ cls: "image-gen-param-chip", text: item });
		}
	}

	private renderReqStatus(req: ReqCheckResult | null): void {
		this.reqEl.empty();
		if (!req) {
			this.reqEl.setText("Python dependencies not checked");
			this.reqEl.removeClass("is-ok");
			this.reqEl.removeClass("is-error");
			return;
		}
		this.reqEl.toggleClass("is-ok", req.ok);
		this.reqEl.toggleClass("is-error", !req.ok);
		this.reqEl.setText(
			req.ok
				? `Python ${req.python} · all packages OK`
				: `Python ${req.python ?? "?"} · missing ${req.errors.length} package(s) — run Install deps`
		);
	}

	private updateServerPill(ready: boolean, loading: boolean, error?: string): void {
		if (!this.genServerPill) return;
		this.genServerPill.removeClass("is-ready");
		this.genServerPill.removeClass("is-loading");
		this.genServerPill.removeClass("is-error");
		if (ready) {
			this.genServerPill.addClass("is-ready");
			this.genServerPill.setText("Server: ready");
		} else if (loading) {
			this.genServerPill.addClass("is-loading");
			this.genServerPill.setText("Server: loading model…");
		} else if (error) {
			this.genServerPill.addClass("is-error");
			this.genServerPill.setText(`Server: ${error}`);
		} else {
			this.genServerPill.addClass("is-error");
			this.genServerPill.setText("Server: offline — open Server tab");
		}
	}

	async onCheckRequirements(verbose = true): Promise<void> {
		const base = this.vaultPath();
		if (!base) {
			new Notice("Could not resolve vault path");
			return;
		}
		const tools = this.toolsDir();
		if (verbose) this.appendShell(`# check requirements in ${tools}`);
		try {
			const req = await this.plugin.serverRunner.checkRequirements(tools, (line) =>
				this.appendShell(line)
			);
			this.lastReq = req;
			this.renderReqStatus(req);
			this.renderConfigDisplay(req.model);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.appendShell(`! check failed: ${msg}`);
			this.renderReqStatus(null);
		}
	}

	async onInstallRequirements(): Promise<void> {
		const base = this.vaultPath();
		if (!base) return;
		const tools = this.toolsDir();
		this.switchTab("server");
		this.appendShell(`# pip install -r requirements.txt`);
		try {
			await this.plugin.serverRunner.installRequirements(tools, (line) =>
				this.appendShell(line)
			);
			new Notice("Dependencies installed");
			await this.onCheckRequirements(false);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.appendShell(`! install failed: ${msg}`);
			new Notice(msg, 8000);
		}
	}

	async onLaunchServer(): Promise<void> {
		const base = this.vaultPath();
		if (!base) {
			new Notice("Could not resolve vault path");
			return;
		}
		const tools = this.toolsDir();
		this.switchTab("server");
		try {
			if (!this.lastReq?.ok) {
				await this.onCheckRequirements(false);
				if (!this.lastReq?.ok) {
					new Notice("Install Python dependencies first", 6000);
					return;
				}
			}
			this.plugin.serverRunner.launchServer(tools, (line) => this.appendShell(line));
			new Notice("Server starting — watch shell output");
			window.setTimeout(() => void this.checkHealth(true), 3000);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.appendShell(`! launch failed: ${msg}`);
			new Notice(msg, 6000);
		}
	}

	onStopServer(): void {
		this.plugin.serverRunner.stopServer((line) => this.appendShell(line));
	}

	startProgress(label: string): void {
		this.stopProgress(false);
		this.progressWrap.removeClass("is-hidden");
		this.progressLabel.setText(label);
		this.progressFill.style.width = "2%";
		let pct = 2;
		this.progressTimer = window.setInterval(() => {
			pct += (94 - pct) * 0.06;
			this.progressFill.style.width = `${pct.toFixed(1)}%`;
		}, 250);
	}

	setProgress(pct: number, label?: string): void {
		this.progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
		if (label) this.progressLabel.setText(label);
	}

	stopProgress(success: boolean): void {
		window.clearInterval(this.progressTimer);
		this.progressTimer = 0;
		if (success) {
			this.setProgress(100, "Done");
			window.setTimeout(() => {
				this.progressWrap.addClass("is-hidden");
				this.progressFill.style.width = "0%";
			}, 500);
		} else {
			this.progressWrap.addClass("is-hidden");
			this.progressFill.style.width = "0%";
		}
	}

	async checkHealth(verbose: boolean): Promise<void> {
		const url = this.plugin.settings.serverUrl;
		if (verbose) this.appendShell(`# GET ${url}/health`);
		try {
			const h = await pingServer(url);
			const ready = !!(h.ready_to_generate || h.ready);
			const loading = !!h.loading;
			const model = h.model ?? h.config?.model ?? DEFAULT_MODEL_LABEL;
			const parts = [
				ready ? "ready" : loading ? "loading" : "offline",
				model.split("/").pop() ?? model,
				h.device ?? "",
				h.max_side ? `${h.max_side}px` : "",
			].filter(Boolean);
			this.statusBarEl.setText(parts.join(" · "));
			this.statusBarEl.toggleClass("is-ready", ready);
			this.statusBarEl.toggleClass("is-error", !!h.error && !ready);
			this.renderConfigDisplay(model);
			this.updateServerPill(ready, loading, h.error ?? undefined);
			if (verbose) this.appendShell(`# ${parts.join(" | ")}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.statusBarEl.setText(`unreachable`);
			this.statusBarEl.removeClass("is-ready");
			this.statusBarEl.addClass("is-error");
			this.updateServerPill(false, false, "offline");
			if (verbose) this.appendShell(`# health failed: ${msg}`);
		}
	}

	async onGenerate(btn: HTMLButtonElement): Promise<void> {
		const prompt = (this.promptArea?.value ?? this.prompt).trim();
		if (!prompt || this.busy) {
			if (!prompt) new Notice("Enter a prompt");
			return;
		}
		this.busy = true;
		btn.setText("Generating…");
		btn.disabled = true;
		this.genStatusEl.setText("");
		this.startProgress("Checking server…");
		try {
			const path = await this.plugin.generateAndInsert(prompt, {
				refreshSidebar: true,
				onProgress: (pct, label) => this.setProgress(pct, label),
			});
			this.stopProgress(true);
			this.genStatusEl.setText(`Saved ${path}`);
			this.renderOutput(path);
			new Notice(`Saved ${path}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.stopProgress(false);
			this.genStatusEl.setText(msg);
			new Notice(msg, 8000);
		} finally {
			this.busy = false;
			btn.setText("Generate");
			btn.disabled = false;
		}
	}

	renderOutput(highlightPath?: string): void {
		const records = this.plugin.recentOutputs;
		const latest = highlightPath
			? records.find((r) => r.path === highlightPath) ?? records[0]
			: records[0];

		this.previewEl.empty();
		if (!latest) {
			this.previewEl.setText("No images yet.");
			this.galleryEl.empty();
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(latest.path);
		if (file instanceof TFile) {
			const img = this.previewEl.createEl("img", { cls: "image-gen-preview-img" });
			img.alt = latest.prompt;
			img.src = this.app.vault.getResourcePath(file);
			this.previewEl.createDiv({
				cls: "image-gen-meta",
				text: latest.prompt.slice(0, 80) + (latest.prompt.length > 80 ? "…" : ""),
			});
			this.previewEl.createDiv({ cls: "image-gen-meta", text: `seed ${latest.seed}` });
			const actions = this.previewEl.createDiv({ cls: "image-gen-row" });
			const openBtn = actions.createEl("button", { text: "Open" });
			openBtn.onclick = () => void this.app.workspace.openLinkText(latest.path, "", false);
			const insertBtn = actions.createEl("button", { text: "Insert link" });
			insertBtn.onclick = () => this.insertLink(latest.path);
		}

		this.galleryEl.empty();
		if (records.length <= 1) return;
		const grid = this.galleryEl.createDiv({ cls: "image-gen-thumb-grid" });
		for (const rec of records.slice(0, 12)) {
			const f = this.app.vault.getAbstractFileByPath(rec.path);
			if (!(f instanceof TFile)) continue;
			const thumb = grid.createDiv({ cls: "image-gen-thumb" });
			if (rec.path === latest.path) thumb.addClass("is-active");
			const timg = thumb.createEl("img");
			timg.src = this.app.vault.getResourcePath(f);
			timg.title = rec.prompt;
			thumb.onclick = () => this.renderOutput(rec.path);
		}
	}

	insertLink(path: string): void {
		const editor = this.app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(`![[${path}]]\n`);
			new Notice("Inserted image link");
		} else {
			new Notice("Open a note to insert the link");
		}
	}
}
