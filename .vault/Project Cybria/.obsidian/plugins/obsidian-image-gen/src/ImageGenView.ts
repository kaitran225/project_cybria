import { ItemView, Menu, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { fetchLoras, fetchModels, pingServer } from "./client";
import type { ReqCheckResult } from "./require-core";
import { LORA_NONE, type LoraInfo } from "./loras";
import { modelsForPicker, modelSupportsLora, type ModelInfo } from "./models";
import {
	ASPECT_PRESETS,
	detectAspect,
	formatSize,
	sizesForAspect,
	type AspectId,
} from "./aspect-ratios";
import { DEFAULT_MODEL_LABEL } from "./settings";
import type ImageGenPlugin from "./main";

export const VIEW_TYPE_IMAGE_GEN = "image-gen-view";

type TabId = "server" | "generate";

export class ImageGenView extends ItemView {
	private prompt = "";
	private busy = false;
	private healthTimer = 0;
	private progressTimer = 0;
	private scrollEl!: HTMLElement;
	private logEl!: HTMLElement;
	private footerEl!: HTMLElement;
	private statusBarEl!: HTMLElement;
	private statusTextEl!: HTMLElement;
	private serverDetailsEl!: HTMLDetailsElement;
	private previewEl!: HTMLElement;
	private galleryEl!: HTMLElement;
	private galleryCardEl!: HTMLElement;
	private genStatusEl!: HTMLElement;
	private promptArea!: HTMLTextAreaElement;
	private promptCountEl!: HTMLElement;
	private progressWrap!: HTMLElement;
	private progressFill!: HTMLElement;
	private progressLabel!: HTMLElement;
	private modelEl!: HTMLElement;
	private reqEl!: HTMLElement;
	private genParamsEl!: HTMLElement;
	private aspectEl!: HTMLElement;
	private widthInput!: HTMLInputElement;
	private heightInput!: HTMLInputElement;
	private stepsInput!: HTMLInputElement;
	private cfgInput!: HTMLInputElement;
	private seedInput!: HTMLInputElement;
	private loraScaleInput!: HTMLInputElement;
	private loraScaleWrap!: HTMLElement;
	private negativeInput!: HTMLTextAreaElement;
	private modelPickerEl!: HTMLElement;
	private modelCatalog: ModelInfo[] = [];
	private loraSectionEl!: HTMLElement;
	private loraEl!: HTMLElement;
	private loraHintEl!: HTMLElement;
	private loraCatalog: LoraInfo[] = [];
	private progressShellLine: HTMLElement | null = null;
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
		this.updatePromptCount();
		this.switchTab("generate");
	}

	async onOpen(): Promise<void> {
		const host = this.contentEl;
		host.empty();
		host.addClass("image-gen-view");

		const scroll = host.createDiv({ cls: "ig-scroll" });
		this.scrollEl = scroll;

		// --- Output (header-less hero preview) ---
		const outputEl = scroll.createDiv({ cls: "ig-output" });
		this.previewEl = outputEl.createDiv({ cls: "image-gen-preview is-empty" });
		this.previewEl.setText("Your latest image will appear here");

		// --- Generate card ---
		const gen = this.makeCard(scroll, "Generate", "sparkles", true);
		const promptWrap = gen.createDiv({ cls: "image-gen-prompt-wrap" });
		this.promptArea = promptWrap.createEl("textarea", {
			cls: "image-gen-prompt",
			attr: { placeholder: "Describe your image…  (Ctrl+Enter to generate)", rows: "4" },
		});
		this.promptArea.oninput = () => {
			this.prompt = this.promptArea.value;
			this.updatePromptCount();
		};
		const promptMeta = promptWrap.createDiv({ cls: "image-gen-prompt-meta" });
		this.promptCountEl = promptMeta.createSpan({ cls: "image-gen-prompt-count", text: "" });

		this.progressWrap = gen.createDiv({ cls: "image-gen-progress is-hidden" });
		this.progressLabel = this.progressWrap.createDiv({
			cls: "image-gen-progress-label",
			text: "Generating…",
		});
		const track = this.progressWrap.createDiv({ cls: "image-gen-progress-track" });
		this.progressFill = track.createDiv({ cls: "image-gen-progress-fill" });

		const genBtn = gen.createEl("button", { cls: "image-gen-gen-btn mod-cta" });
		const genBtnIcon = genBtn.createSpan({ cls: "ig-btn-icon" });
		setIcon(genBtnIcon, "sparkles");
		genBtn.createSpan({ text: "Generate" });
		genBtn.onclick = () => void this.onGenerate(genBtn);
		this.promptArea.onkeydown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				void this.onGenerate(genBtn);
			}
		};
		this.genStatusEl = gen.createDiv({ cls: "image-gen-status is-hidden" });

		// --- Settings card (Model / Size & quality / Style) ---
		const settingsBody = this.makeCard(scroll, "Settings", "sliders-horizontal", true);
		const modelGroup = this.makeSubgroup(settingsBody, "Model");
		const modelBody = this.subgroupBody(modelGroup);
		this.modelPickerEl = modelBody.createDiv({ cls: "image-gen-model-grid" });

		const sizeGroup = this.makeSubgroup(settingsBody, "Size & quality");
		this.genParamsEl = this.subgroupBody(sizeGroup).createDiv({ cls: "image-gen-params-card" });
		this.buildParamsControls();

		this.loraSectionEl = this.makeSubgroup(
			settingsBody,
			"LoRA",
			"image-gen-lora-section is-hidden"
		);
		const loraBody = this.subgroupBody(this.loraSectionEl);
		this.loraHintEl = loraBody.createDiv({ cls: "image-gen-section-hint is-hidden" });
		this.loraEl = loraBody.createDiv({ cls: "image-gen-lora-grid" });
		const loraScaleRow = loraBody.createDiv({ cls: "image-gen-lora-scale-row" });
		this.loraScaleInput = this.addNumberField(loraScaleRow, "Strength", (v) => {
			this.plugin.settings.loraScale = Math.max(0, Math.min(2, v));
			void this.saveParams();
		}, true);
		this.loraScaleWrap = this.loraScaleInput.parentElement as HTMLElement;
		this.loraScaleWrap.addClass("image-gen-lora-scale-field");

		// --- Server card (no terminal) ---
		const srvBody = this.makeCard(scroll, "Server", "server", false, "image-gen-server-collapse");
		this.serverDetailsEl = srvBody.closest("details") as HTMLDetailsElement;
		this.statusBarEl = (this.serverDetailsEl.querySelector(".ig-card-head") as HTMLElement).createDiv({
			cls: "image-gen-status-bar",
		});
		this.statusBarEl.createDiv({ cls: "image-gen-status-dot" });
		this.statusTextEl = this.statusBarEl.createDiv({
			cls: "image-gen-status-text",
			text: "unknown",
		});

		const actions = srvBody.createDiv({ cls: "image-gen-server-actions" });
		const launchBtn = actions.createEl("button", {
			cls: "image-gen-action-btn mod-cta",
			text: "Launch",
			attr: { title: "Launch server" },
		});
		launchBtn.onclick = () => void this.onLaunchServer();
		actions.createEl("button", {
			cls: "image-gen-action-btn",
			text: "Stop",
			attr: { title: "Stop server" },
		}).onclick = () => this.onStopServer();
		actions.createEl("button", {
			cls: "image-gen-action-btn",
			text: "Health",
			attr: { title: "Health check" },
		}).onclick = () => void this.checkHealth(true);
		actions.createEl("button", {
			cls: "image-gen-action-btn",
			text: "Check",
			attr: { title: "Check Python dependencies" },
		}).onclick = () => void this.onCheckRequirements();
		actions.createEl("button", {
			cls: "image-gen-action-btn",
			text: "Install",
			attr: { title: "Install Python dependencies" },
		}).onclick = () => void this.onInstallRequirements();

		const configBody = srvBody.createDiv({ cls: "image-gen-config-body" });
		const urlField = configBody.createDiv({ cls: "image-gen-config-field" });
		urlField.createDiv({ cls: "image-gen-config-label", text: "Server URL" });
		const urlInput = urlField.createEl("input", {
			cls: "image-gen-config-input",
			attr: { type: "text", spellcheck: "false", placeholder: "http://127.0.0.1:8789" },
		});
		urlInput.value = this.plugin.settings.serverUrl;
		urlInput.onchange = () => {
			this.plugin.settings.serverUrl = urlInput.value.trim();
			void this.plugin.saveSettings();
			void this.checkHealth(true);
		};

		const toolsField = configBody.createDiv({ cls: "image-gen-config-field" });
		toolsField.createDiv({ cls: "image-gen-config-label", text: "Tools path (optional)" });
		const toolsInput = toolsField.createEl("input", {
			cls: "image-gen-config-input",
			attr: { type: "text", spellcheck: "false", placeholder: "default: <repo>/.tools/qwen-image" },
		});
		toolsInput.value = this.plugin.settings.qwenToolsPath;
		toolsInput.onchange = () => {
			this.plugin.settings.qwenToolsPath = toolsInput.value.trim();
			void this.plugin.saveSettings();
		};

		const infoRow = configBody.createDiv({ cls: "image-gen-config-info" });
		const modelKv = infoRow.createDiv({ cls: "image-gen-config-kv" });
		modelKv.createSpan({ cls: "image-gen-config-kv-label", text: "Model" });
		this.modelEl = modelKv.createSpan({ cls: "image-gen-config-kv-value image-gen-model" });
		this.reqEl = infoRow.createDiv({ cls: "image-gen-req" });

		// --- Terminal card ---
		const termBody = this.makeCard(scroll, "Terminal", "terminal", false, "ig-terminal-card");
		const termHead = termBody.closest("details")?.querySelector(".ig-card-head") as HTMLElement;
		const chevron = termHead?.querySelector(".ig-card-chevron") ?? null;
		const clearBtn = termHead.createEl("button", {
			cls: "image-gen-terminal-clear",
			text: "Clear",
		});
		if (chevron) termHead.insertBefore(clearBtn, chevron);
		clearBtn.onclick = () => {
			this.logEl.empty();
			this.progressShellLine = null;
		};
		this.footerEl = termBody.createDiv({ cls: "image-gen-terminal-wrap" });
		this.logEl = this.footerEl.createDiv({ cls: "image-gen-terminal" });

		// --- Gallery card (bottom) ---
		const galleryBody = this.makeCard(scroll, "Gallery", "images", false, "ig-gallery-card is-hidden");
		this.galleryCardEl = galleryBody.closest("details") as HTMLElement;
		this.galleryEl = galleryBody.createDiv({ cls: "image-gen-gallery" });

		// --- Init ---
		this.renderConfigDisplay();
		this.renderReqStatus(null);
		this.syncParamsControls();
		this.renderModelPicker();
		this.updatePromptCount();
		this.updateLoraSectionVisibility();

		this.appendShell("# server shell — pip / python output");
		void this.onCheckRequirements(false);
		void this.checkHealth(true);
		void this.refreshModels();
		void this.refreshLoras(false);
		this.healthTimer = window.setInterval(() => void this.checkHealth(false), 8000);
		this.renderOutput();
	}

	/** Material-style collapsible card. Returns the card body element. */
	private makeCard(
		parent: HTMLElement,
		title: string,
		icon: string,
		open: boolean,
		extraCls = ""
	): HTMLElement {
		const card = parent.createEl("details", { cls: `ig-card ${extraCls}`.trim() });
		card.open = open;
		const head = card.createEl("summary", { cls: "ig-card-head" });
		const ic = head.createSpan({ cls: "ig-card-icon" });
		setIcon(ic, icon);
		head.createSpan({ cls: "ig-card-title", text: title });
		head.createSpan({ cls: "ig-card-chevron" });
		return card.createDiv({ cls: "ig-card-body" });
	}

	/** Slim labeled sub-group inside Settings card. Returns the wrap element. */
	private makeSubgroup(parent: HTMLElement, label: string, extraCls = ""): HTMLElement {
		const wrap = parent.createDiv({ cls: `ig-subgroup ${extraCls}`.trim() });
		wrap.createDiv({ cls: "ig-subgroup-label", text: label });
		wrap.createDiv({ cls: "ig-subgroup-body" });
		return wrap;
	}

	private subgroupBody(wrap: HTMLElement): HTMLElement {
		return wrap.querySelector(".ig-subgroup-body") as HTMLElement;
	}

	async onClose(): Promise<void> {
		window.clearInterval(this.healthTimer);
		this.stopProgress(false);
		this.contentEl.empty();
	}

	private switchTab(tab: TabId): void {
		if (tab === "server") {
			if (this.serverDetailsEl) {
				this.serverDetailsEl.open = true;
				this.serverDetailsEl.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		} else {
			this.scrollEl?.scrollTo({ top: 0, behavior: "smooth" });
			this.promptArea?.focus();
		}
	}

	private updatePromptCount(): void {
		if (!this.promptCountEl) return;
		const n = (this.promptArea?.value ?? this.prompt).length;
		this.promptCountEl.setText(n > 0 ? `${n} chars` : "");
		this.promptCountEl.toggleClass("is-long", n > 500);
	}

	private friendlyError(msg: string): string {
		if (/aborted|AbortError/i.test(msg)) {
			return "Generation stopped. Check the Server tab — it may still be working.";
		}
		if (/Timed out/i.test(msg)) {
			return msg.replace(/Settings[^.]*\./, "Settings (timeout = 0 means no limit).");
		}
		if (/not ready|not reachable|503|offline|Failed to fetch/i.test(msg)) {
			return "Server not running — expand the Server section below and tap Launch.";
		}
		return msg;
	}

	private setGenStatus(text: string, kind?: "error" | "success"): void {
		this.genStatusEl.removeClass("is-error");
		this.genStatusEl.removeClass("is-success");
		this.genStatusEl.toggleClass("is-hidden", !text);
		if (kind === "error") this.genStatusEl.addClass("is-error");
		if (kind === "success") this.genStatusEl.addClass("is-success");
		this.genStatusEl.setText(text);
	}

	private currentModelSpec(): ModelInfo | undefined {
		return this.availableModels().find((m) => m.id === this.activeImageModelId());
	}

	private updateLoraSectionVisibility(): void {
		if (!this.loraSectionEl) return;
		const spec = this.currentModelSpec();
		const supports = spec ? modelSupportsLora(spec.family) : false;
		this.loraSectionEl.toggleClass("is-hidden", !supports);
		if (!supports && this.plugin.settings.lora) {
			this.plugin.settings.lora = "";
			void this.plugin.saveSettings();
		}
		this.toggleLoraScaleField();
	}

	private toggleLoraScaleField(): void {
		if (!this.loraScaleWrap) return;
		const spec = this.currentModelSpec();
		const supports = spec ? modelSupportsLora(spec.family) : false;
		this.loraScaleWrap.toggleClass(
			"is-hidden",
			!supports || !this.plugin.settings.lora
		);
	}

	appendShell(line: string): void {
		if (!this.logEl) return;
		const cleaned = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\[A/g, "").trimEnd();
		if (!cleaned || cleaned === "[" || cleaned === "[A") return;

		const cls = this.shellLineClass(cleaned);
		if (cls === "shell-progress") {
			if (!this.progressShellLine || !this.logEl.contains(this.progressShellLine)) {
				this.progressShellLine = this.logEl.createDiv({
					cls: `image-gen-shell-line shell-progress`,
				});
			}
			this.renderShellLine(this.progressShellLine, cleaned, cls);
		} else {
			this.progressShellLine = null;
			const row = this.logEl.createDiv({ cls: `image-gen-shell-line ${cls}` });
			this.renderShellLine(row, cleaned, cls);
		}
		this.logEl.scrollTop = this.logEl.scrollHeight;
	}

	private renderShellLine(el: HTMLElement, line: string, cls: string): void {
		el.empty();
		el.className = `image-gen-shell-line ${cls}`;

		// Uvicorn: INFO: 127.0.0.1:port - "GET /path HTTP/1.1" 200 OK
		const uvicorn = line.match(
			/^INFO:\s+(\S+)\s+-\s+"(GET|POST|PUT|DELETE)\s+(\S+)\s+HTTP\/[\d.]+"\s+(\d+)(?:\s+(.*))?$/
		);
		if (uvicorn) {
			el.createSpan({ cls: "shell-tag shell-tag-info", text: "INFO" });
			el.appendText(` ${uvicorn[1]} `);
			el.createSpan({ cls: "shell-tag shell-tag-method", text: uvicorn[2] });
			el.appendText(" ");
			el.createSpan({ cls: "shell-tag shell-tag-path", text: uvicorn[3] });
			const code = parseInt(uvicorn[4], 10);
			const codeCls = code >= 400 ? "shell-tag-error" : "shell-tag-ok";
			el.appendText(" ");
			el.createSpan({ cls: `shell-tag ${codeCls}`, text: String(code) });
			if (uvicorn[5]) el.createSpan({ cls: "shell-tag shell-tag-ok", text: ` ${uvicorn[5]}` });
			return;
		}

		if (line.startsWith("$ ")) {
			el.createSpan({ cls: "shell-tag shell-tag-cmd", text: "$" });
			el.createSpan({ text: line.slice(1) });
			return;
		}
		if (line.startsWith("# ")) {
			el.createSpan({ cls: "shell-tag shell-tag-comment", text: "#" });
			el.createSpan({ text: line.slice(1) });
			return;
		}
		if (line.startsWith("! ")) {
			el.createSpan({ cls: "shell-tag shell-tag-error", text: "!" });
			el.createSpan({ text: line.slice(1) });
			return;
		}

		const tagMatch = line.match(/^(\[[\w]+\])/);
		if (tagMatch) {
			const tag = tagMatch[1];
			let tagCls = "shell-tag-load";
			if (tag.startsWith("[generate]") || tag.startsWith("[enhance]") || tag.startsWith("[park]"))
				tagCls = "shell-tag-generate";
			else if (tag.startsWith("[warmup]") || tag.startsWith("[exit")) tagCls = "shell-tag-warn";
			el.createSpan({ cls: `shell-tag ${tagCls}`, text: tag });
			el.createSpan({ text: line.slice(tag.length) });
			return;
		}

		el.setText(line);
	}

	private shellLineClass(line: string): string {
		const t = line.trim();
		if (!t) return "shell-muted";
		if (t.startsWith("!")) return "shell-error";
		if (/Traceback|AttributeError|Error:|ERROR|failed|Exception/i.test(t)) return "shell-error";
		if (t.startsWith("$")) return "shell-cmd";
		if (t.startsWith("#")) return "shell-comment";
		if (t.startsWith("[load]")) return "shell-load";
		if (t.startsWith("[generate]") || t.startsWith("[enhance]") || t.startsWith("[park]"))
			return "shell-generate";
		if (t.startsWith("[warmup]") || t.startsWith("[exit")) return "shell-warn";
		if (/^INFO:/.test(t) && /\s200\s/.test(t)) return "shell-http-ok";
		if (/^INFO:/.test(t)) return "shell-info";
		if (/\d+%\|/.test(t) || /Loading weights|it\/s/.test(t)) return "shell-progress";
		if (/200 OK|ready|Successfully/i.test(t)) return "shell-ok";
		if (/^(Collecting|Installing|Requirement|Downloading|Using cached)/i.test(t)) return "shell-pip";
		if (/deprecated|warning/i.test(t)) return "shell-warn";
		if (/^Uvicorn running|^Started server/i.test(t)) return "shell-ok";
		if (/^(GET|POST|PUT|DELETE)\s/i.test(t) || /HTTP\/\d/.test(t)) return "shell-http";
		return "shell-default";
	}

	private vaultPath(): string {
		return (this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? "";
	}

	private toolsDir(): string {
		return this.plugin.getCore().resolveToolsDir(
			"image",
			this.plugin.settings.qwenToolsPath
		);
	}

	private renderConfigDisplay(modelOverride?: string): void {
		const model = modelOverride ?? this.lastReq?.model ?? DEFAULT_MODEL_LABEL;
		this.modelEl.setText(model.split("/").pop() ?? model);
	}

	private availableModels(): ModelInfo[] {
		return modelsForPicker(this.modelCatalog);
	}

	private longEdgeForModel(): number {
		const spec = this.availableModels().find((m) => m.id === this.plugin.settings.modelId);
		return spec?.default_size ?? Math.max(this.plugin.settings.width, this.plugin.settings.height);
	}

	private buildParamsControls(): void {
		this.genParamsEl.empty();

		this.genParamsEl.createDiv({
			cls: "image-gen-param-label",
			text: "Aspect",
		});
		this.aspectEl = this.genParamsEl.createDiv({ cls: "image-gen-aspect-row" });

		const grid = this.genParamsEl.createDiv({ cls: "image-gen-param-form-grid" });
		this.widthInput = this.addNumberField(grid, "Width", (v) => {
			this.plugin.settings.width = v;
			this.plugin.settings.aspectRatio = detectAspect(v, this.plugin.settings.height);
			void this.saveParams();
		});
		this.heightInput = this.addNumberField(grid, "Height", (v) => {
			this.plugin.settings.height = v;
			this.plugin.settings.aspectRatio = detectAspect(this.plugin.settings.width, v);
			void this.saveParams();
		});
		this.stepsInput = this.addNumberField(grid, "Steps", (v) => {
			this.plugin.settings.steps = v;
			void this.saveParams();
		});
		this.cfgInput = this.addNumberField(grid, "Guidance", (v) => {
			this.plugin.settings.cfg = v;
			void this.saveParams();
		}, true);

		const seedRow = this.genParamsEl.createDiv({ cls: "image-gen-param-form-grid is-2col" });
		const seedWrap = seedRow.createDiv({ cls: "image-gen-param-field" });
		seedWrap.createDiv({ cls: "image-gen-param-label", text: "Seed" });
		const seedInputRow = seedWrap.createDiv({ cls: "image-gen-seed-row" });
		this.seedInput = seedInputRow.createEl("input", {
			cls: "image-gen-param-input",
			attr: { type: "text", placeholder: "random" },
		});
		this.seedInput.onchange = () => {
			this.plugin.settings.seed = this.seedInput.value.trim();
			void this.saveParams();
		};
		const randomBtn = seedInputRow.createEl("button", {
			cls: "image-gen-seed-random",
			text: "Random",
		});
		randomBtn.onclick = () => {
			this.plugin.settings.seed = "";
			this.seedInput.value = "";
			void this.saveParams();
		};

		const adv = this.genParamsEl.createEl("details", { cls: "image-gen-advanced" });
		adv.createEl("summary", { text: "More options" });
		const negWrap = adv.createDiv({ cls: "image-gen-param-field" });
		negWrap.createDiv({ cls: "image-gen-param-label", text: "Negative prompt" });
		this.negativeInput = negWrap.createEl("textarea", {
			cls: "image-gen-param-textarea",
			attr: { rows: "2", placeholder: "Things to avoid…" },
		});
		this.negativeInput.onchange = () => {
			this.plugin.settings.negativePrompt = this.negativeInput.value;
			void this.saveParams();
		};

		this.renderAspectPicker();
		this.syncParamsControls();
	}

	private addNumberField(
		parent: HTMLElement,
		label: string,
		onChange: (v: number) => void,
		allowFloat = false
	): HTMLInputElement {
		const wrap = parent.createDiv({ cls: "image-gen-param-field" });
		wrap.createDiv({ cls: "image-gen-param-label", text: label });
		const input = wrap.createEl("input", {
			cls: "image-gen-param-input",
			attr: { type: "number", min: "0", step: allowFloat ? "0.1" : "1" },
		});
		input.onchange = () => {
			const raw = allowFloat ? parseFloat(input.value) : parseInt(input.value, 10);
			if (!Number.isNaN(raw)) onChange(raw);
		};
		return input;
	}

	private async saveParams(): Promise<void> {
		this.renderAspectPicker();
		await this.plugin.saveSettings();
	}

	syncParamsControls(): void {
		if (!this.widthInput) return;
		const s = this.plugin.settings;
		this.widthInput.value = String(s.width);
		this.heightInput.value = String(s.height);
		this.stepsInput.value = String(s.steps);
		this.cfgInput.value = String(s.cfg);
		this.seedInput.value = s.seed;
		if (this.loraScaleInput) this.loraScaleInput.value = String(s.loraScale);
		this.negativeInput.value = s.negativePrompt;
		this.renderAspectPicker();
		this.toggleLoraScaleField();
	}

	renderAspectPicker(): void {
		if (!this.aspectEl) return;
		this.aspectEl.empty();
		const s = this.plugin.settings;
		const active =
			s.aspectRatio === "custom"
				? detectAspect(s.width, s.height)
				: (s.aspectRatio as AspectId);

		for (const preset of ASPECT_PRESETS) {
			const { width, height } = sizesForAspect(preset.id, this.longEdgeForModel());
			const sizeLabel = formatSize(width, height);
			const btn = this.aspectEl.createEl("button", {
				cls: "image-gen-aspect-chip",
				attr: { type: "button", title: sizeLabel },
			});
			btn.createSpan({ cls: "image-gen-aspect-label", text: preset.label });
			btn.createSpan({ cls: "image-gen-aspect-size", text: sizeLabel });
			btn.toggleClass("is-active", preset.id === active);
			btn.onclick = () => void this.applyAspect(preset.id);
		}
	}

	private async applyAspect(id: Exclude<AspectId, "custom">): Promise<void> {
		const { width, height } = sizesForAspect(id, this.longEdgeForModel());
		this.plugin.settings.aspectRatio = id;
		this.plugin.settings.width = width;
		this.plugin.settings.height = height;
		await this.saveParams();
		this.syncParamsControls();
	}

	renderGenParams(): void {
		this.syncParamsControls();
	}

	async refreshModels(): Promise<void> {
		try {
			const catalog = await fetchModels(this.plugin.settings.serverUrl);
			this.modelCatalog = catalog.models;
			if (!this.modelCatalog.some((m) => m.id === this.plugin.settings.modelId)) {
				this.plugin.settings.modelId = catalog.default;
				await this.plugin.saveSettings();
			}
			this.renderModelPicker();
			this.renderGenParams();
		} catch {
			this.modelCatalog = [];
			this.renderModelPicker();
		}
	}

	renderModelPicker(): void {
		if (!this.modelPickerEl) return;
		this.modelPickerEl.empty();
		const active = this.activeImageModelId();
		const models = this.availableModels();
		const serverOnline = this.modelCatalog.length > 0;

		for (const entry of models) {
			const btn = this.modelPickerEl.createEl("button", {
				cls: "image-gen-model-chip",
				text: entry.name,
			});
			btn.toggleClass("is-active", entry.id === active);
			const title = entry.note ?? (entry.lightning ? "Fast mode" : entry.repo_id);
			btn.setAttr("title", title);
			btn.onclick = () => void this.selectModel(entry.id);
		}

		this.updateLoraSectionVisibility();

		if (!serverOnline) {
			this.modelPickerEl.createDiv({
				cls: "image-gen-section-hint",
				text: "Launch the server below to load the selected model.",
			});
		}
	}

	private async selectModel(id: string): Promise<void> {
		if (this.activeImageModelId() === id) return;
		const spec = this.availableModels().find((m) => m.id === id);
		this.plugin.settings.modelId = id;
		if (spec) {
			this.plugin.settings.aspectRatio = "1:1";
			const { width, height } = sizesForAspect("1:1", spec.default_size);
			this.plugin.settings.width = width;
			this.plugin.settings.height = height;
			this.plugin.settings.steps = spec.default_steps;
			this.plugin.settings.cfg = spec.default_cfg;
		}
		const loraStillOk = this.loraCatalog.find(
			(l) => l.id === this.plugin.settings.lora && l.compatible
		);
		if (!loraStillOk) this.plugin.settings.lora = "";
		await this.plugin.saveSettings();
		this.renderModelPicker();
		this.renderGenParams();
		await this.refreshLoras(false);
		try {
			await this.plugin.getCore().switcher.activate("image", id, {
				ensureServer: true,
				onLog: (l) => this.appendShell(l),
			});
			new Notice(spec ? `Model loaded: ${spec.name}` : "Model loaded", 4000);
		} catch (e) {
			new Notice(
				e instanceof Error ? e.message : String(e),
				5000
			);
		}
	}

	private activeImageModelId(): string {
		try {
			return this.plugin.getCore().switcher.getActiveModel("image");
		} catch {
			return this.plugin.settings.modelId;
		}
	}

	private loraDirPath(): string {
		return this.plugin.getCore().modelPaths().loras;
	}

	async refreshLoras(verbose = true): Promise<void> {
		const spec = this.currentModelSpec();
		const supports = spec ? modelSupportsLora(spec.family) : false;
		this.updateLoraSectionVisibility();
		if (!supports) {
			this.loraCatalog = [];
			this.renderLoraPicker();
			return;
		}

		const url = this.plugin.settings.serverUrl;
		const modelId = this.activeImageModelId();
		try {
			const catalog = await fetchLoras(url, modelId, verbose);
			this.loraCatalog = catalog.loras;
			const compatible = this.loraCatalog.filter((l) => l.compatible);
			if (compatible.length === 0) {
				this.loraHintEl.removeClass("is-hidden");
				this.loraHintEl.setText(
					catalog.exists
						? `No LoRAs compatible with this model in ${this.loraDirPath()}`
						: `Add .safetensors to ${this.loraDirPath()}`
				);
			} else {
				this.loraHintEl.addClass("is-hidden");
				this.loraHintEl.setText("");
			}
			const activeLora = compatible.find((l) => l.id === this.plugin.settings.lora);
			if (this.plugin.settings.lora && !activeLora) {
				this.plugin.settings.lora = "";
				await this.plugin.saveSettings();
			}
			this.renderLoraPicker();
			this.toggleLoraScaleField();
		} catch {
			this.loraCatalog = [];
			this.loraHintEl.removeClass("is-hidden");
			this.loraHintEl.setText("Launch the server to scan LoRA files");
			this.renderLoraPicker();
			this.toggleLoraScaleField();
		}
	}

	renderLoraPicker(): void {
		if (!this.loraEl) return;
		this.loraEl.empty();

		const noneBtn = this.loraEl.createEl("button", {
			cls: "image-gen-lora-chip",
			text: "None",
		});
		noneBtn.toggleClass("is-active", !this.plugin.settings.lora);
		noneBtn.onclick = () => void this.selectLora(LORA_NONE);

		for (const entry of this.loraCatalog.filter((l) => l.compatible)) {
			const btn = this.loraEl.createEl("button", {
				cls: "image-gen-lora-chip",
				text: entry.name,
			});
			btn.toggleClass("is-active", this.plugin.settings.lora === entry.id);
			btn.onclick = () => void this.selectLora(entry.id);
		}
	}

	private async selectLora(id: string): Promise<void> {
		this.plugin.settings.lora = id;
		await this.plugin.saveSettings();
		this.renderLoraPicker();
		this.toggleLoraScaleField();
	}

	private renderReqStatus(req: ReqCheckResult | null): void {
		this.reqEl.empty();
		if (!req) {
			this.reqEl.setText("Python dependencies not checked yet");
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

	private setStatusBar(text: string, state: "ready" | "loading" | "error" | "unknown"): void {
		this.statusTextEl.setText(text);
		this.statusBarEl.removeClass("is-ready");
		this.statusBarEl.removeClass("is-loading");
		this.statusBarEl.removeClass("is-error");
		if (state === "ready") this.statusBarEl.addClass("is-ready");
		else if (state === "loading") this.statusBarEl.addClass("is-loading");
		else if (state === "error") this.statusBarEl.addClass("is-error");
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
			const req = await this.plugin.getCore().runner("image").checkRequirements(tools, (line) =>
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
			await this.plugin.getCore().runner("image").installRequirements(tools, (line) =>
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
			this.plugin.getCore().runner("image").launchServer(tools, (line) => this.appendShell(line));
			new Notice("Server starting — watch shell output");
			window.setTimeout(() => void this.checkHealth(true), 3000);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.appendShell(`! launch failed: ${msg}`);
			new Notice(msg, 6000);
		}
	}

	onStopServer(): void {
		this.plugin.getCore().runner("image").stopServer((line) => this.appendShell(line));
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
			const statusText = parts.join(" · ");
			this.setStatusBar(
				statusText,
				ready ? "ready" : loading ? "loading" : h.error ? "error" : "error"
			);
			this.renderConfigDisplay(model);
			if (ready) {
				void this.refreshModels();
				void this.refreshLoras(false);
			}
			if (verbose) this.appendShell(`# ${parts.join(" | ")}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.setStatusBar("unreachable", "error");
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
		this.setGenStatus("");
		this.startProgress("Checking server…");
		try {
			const path = await this.plugin.generateAndInsert(prompt, {
				refreshSidebar: true,
				onProgress: (pct, label) => this.setProgress(pct, label),
			});
			this.stopProgress(true);
			this.setGenStatus(`Saved ${path.split("/").pop() ?? path}`, "success");
			this.renderOutput(path);
			new Notice(`Saved ${path}`);
		} catch (e) {
			const raw = e instanceof Error ? e.message : String(e);
			const msg = this.friendlyError(raw);
			this.stopProgress(false);
			this.setGenStatus(msg, "error");
			new Notice(msg, 8000);
			if (/not ready|not reachable|503|offline|Failed to fetch/i.test(raw)) {
				this.switchTab("server");
			}
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
		this.previewEl.removeClass("is-empty");

		if (!latest) {
			this.previewEl.addClass("is-empty");
			this.previewEl.setText("Your latest image will appear here");
			this.galleryEl.empty();
			this.galleryCardEl?.addClass("is-hidden");
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(latest.path);
		if (file instanceof TFile) {
			const frame = this.previewEl.createDiv({ cls: "image-gen-preview-frame" });
			const img = frame.createEl("img", { cls: "image-gen-preview-img" });
			img.alt = latest.prompt;
			img.title = `${latest.prompt}\nseed ${latest.seed}`;
			img.src = this.app.vault.getResourcePath(file);
			img.ondblclick = () => void this.app.workspace.openLinkText(latest.path, "", false);

			const menuBtn = frame.createEl("button", {
				cls: "image-gen-preview-menu clickable-icon",
				attr: { type: "button", "aria-label": "Image actions" },
			});
			setIcon(menuBtn, "more-vertical");
			menuBtn.onclick = (ev: MouseEvent) => {
				ev.stopPropagation();
				const menu = new Menu();
				menu.addItem((item) =>
					item
						.setTitle("Open")
						.setIcon("file")
						.onClick(() => void this.app.workspace.openLinkText(latest.path, "", false))
				);
				menu.addItem((item) =>
					item
						.setTitle("Insert link")
						.setIcon("link")
						.onClick(() => this.insertLink(latest.path))
				);
				menu.addItem((item) =>
					item.setTitle("Copy seed").setIcon("hash").onClick(() => {
						void navigator.clipboard.writeText(String(latest.seed));
						new Notice("Seed copied");
					})
				);
				menu.showAtMouseEvent(ev);
			};

			const meta = this.previewEl.createDiv({ cls: "image-gen-preview-meta" });
			meta.createSpan({
				cls: "image-gen-preview-prompt",
				text: latest.prompt,
				attr: { title: latest.prompt },
			});
			meta.createSpan({
				cls: "image-gen-preview-seed",
				text: String(latest.seed),
				attr: { title: `seed ${latest.seed}` },
			});
		}

		this.galleryEl.empty();
		const showGallery = records.length > 1;
		this.galleryCardEl?.toggleClass("is-hidden", !showGallery);
		if (!showGallery) return;

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
