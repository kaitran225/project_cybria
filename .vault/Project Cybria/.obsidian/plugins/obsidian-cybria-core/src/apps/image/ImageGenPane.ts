import { Menu, Notice, TFile, setIcon } from "obsidian";
import { catalogForProfile } from "../../hardware-profiles";
import type CybriaCorePlugin from "../../main";
import type { AppPane } from "../types";
import { imageModelsFromCatalog, modelsForPicker, modelSupportsLora, type ModelInfo } from "./models";
import {
	ASPECT_PRESETS,
	detectAspect,
	formatSize,
	sizesForAspect,
	type AspectId,
} from "./aspect-ratios";
import { DEFAULT_MODEL_LABEL } from "./settings";
import { LORA_NONE, type LoraInfo } from "./loras";

export class ImageGenPane implements AppPane {
	private prompt = "";
	private busy = false;
	private healthTimer = 0;
	private progressTimer = 0;
	private scrollEl!: HTMLElement;
	private statusBarEl!: HTMLElement;
	private statusTextEl!: HTMLElement;
	private previewEl!: HTMLElement;
	private galleryEl!: HTMLElement;
	private galleryCardEl!: HTMLElement;
	private genStatusEl!: HTMLElement;
	private promptArea!: HTMLTextAreaElement;
	private promptCountEl!: HTMLElement;
	private progressWrap!: HTMLElement;
	private progressFill!: HTMLElement;
	private progressLabel!: HTMLElement;
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
	private modelCatalog: ModelInfo[] = [];
	private loraSectionEl!: HTMLElement;
	private loraEl!: HTMLElement;
	private loraHintEl!: HTMLElement;
	private loraCatalog: LoraInfo[] = [];
	private lastSyncedModelId = "";
	private root: HTMLElement | null = null;
	private unsubSwitcher: (() => void) | null = null;

	constructor(private readonly plugin: CybriaCorePlugin) {}

	setPrompt(text: string): void {
		this.prompt = text;
		if (this.promptArea) this.promptArea.value = text;
		this.updatePromptCount();
		
	}

	mount(root: HTMLElement): void {
		this.root = root;
		const host = root;
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

		const statusWrap = gen.createDiv({ cls: "image-gen-status-bar-wrap" });
		this.statusBarEl = statusWrap.createDiv({ cls: "image-gen-status-bar" });
		this.statusBarEl.createDiv({ cls: "image-gen-status-dot" });
		this.statusTextEl = this.statusBarEl.createDiv({
			cls: "image-gen-status-text",
			text: "checking…",
		});

		// --- Settings card (Size & quality / Style) ---
		const settingsBody = this.makeCard(scroll, "Settings", "sliders-horizontal", true);

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
			this.plugin.settings.image.loraScale = Math.max(0, Math.min(2, v));
			void this.saveParams();
		}, true);
		this.loraScaleWrap = this.loraScaleInput.parentElement as HTMLElement;
		this.loraScaleWrap.addClass("image-gen-lora-scale-field");

		// --- Gallery card (bottom) ---
		const galleryBody = this.makeCard(scroll, "Gallery", "images", false, "ig-gallery-card is-hidden");
		this.galleryCardEl = galleryBody.closest("details") as HTMLElement;
		this.galleryEl = galleryBody.createDiv({ cls: "image-gen-gallery" });

		// --- Init ---
		this.syncParamsControls();
		this.updatePromptCount();
		this.updateLoraSectionVisibility();

		try {
			this.unsubSwitcher = this.plugin.api.switcher.onChange((slot) => {
				if (slot === "image") void this.applyModelFromCore();
			});
		} catch {
			/* core not ready */
		}

		void this.checkHealth(false);
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

	unmount(): void {
		window.clearInterval(this.healthTimer);
		this.healthTimer = 0;
		this.stopProgress(false);
		this.unsubSwitcher?.();
		this.unsubSwitcher = null;
		this.root?.empty();
		this.root = null;
	}

	onShow(): void {
		void this.checkHealth(false);
	}

	private imageUrl(): string {
		return this.plugin.api.serviceUrl("image");
	}

	private updatePromptCount(): void {
		if (!this.promptCountEl) return;
		const n = (this.promptArea?.value ?? this.prompt).length;
		this.promptCountEl.setText(n > 0 ? `${n} chars` : "");
		this.promptCountEl.toggleClass("is-long", n > 500);
	}

	private friendlyError(msg: string): string {
		if (/aborted|AbortError/i.test(msg)) {
			return "Generation stopped.";
		}
		if (/Timed out/i.test(msg)) {
			return msg.replace(/Settings[^.]*\./, "Settings (timeout = 0 means no limit).");
		}
		if (/not ready|not reachable|503|offline|Failed to fetch/i.test(msg)) {
			return "Image server offline — open Cybria AI → Servers to launch.";
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
		if (!supports && this.plugin.settings.image.lora) {
			this.plugin.settings.image.lora = "";
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
			!supports || !this.plugin.settings.image.lora
		);
	}

	private availableModels(): ModelInfo[] {
		const fallback = imageModelsFromCatalog(
			catalogForProfile("image", this.plugin.settings.hardwareProfile)
		);
		return modelsForPicker(this.modelCatalog, fallback);
	}

	private longEdgeForModel(): number {
		const spec = this.availableModels().find((m) => m.id === this.activeImageModelId());
		return spec?.default_size ?? Math.max(this.plugin.settings.image.width, this.plugin.settings.image.height);
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
			this.plugin.settings.image.width = v;
			this.plugin.settings.image.aspectRatio = detectAspect(v, this.plugin.settings.image.height);
			void this.saveParams();
		});
		this.heightInput = this.addNumberField(grid, "Height", (v) => {
			this.plugin.settings.image.height = v;
			this.plugin.settings.image.aspectRatio = detectAspect(this.plugin.settings.image.width, v);
			void this.saveParams();
		});
		this.stepsInput = this.addNumberField(grid, "Steps", (v) => {
			this.plugin.settings.image.steps = v;
			void this.saveParams();
		});
		this.cfgInput = this.addNumberField(grid, "Guidance", (v) => {
			this.plugin.settings.image.cfg = v;
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
			this.plugin.settings.image.seed = this.seedInput.value.trim();
			void this.saveParams();
		};
		const randomBtn = seedInputRow.createEl("button", {
			cls: "image-gen-seed-random",
			text: "Random",
		});
		randomBtn.onclick = () => {
			this.plugin.settings.image.seed = "";
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
			this.plugin.settings.image.negativePrompt = this.negativeInput.value;
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
		const s = this.plugin.settings.image;
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
		const s = this.plugin.settings.image;
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
		this.plugin.settings.image.aspectRatio = id;
		this.plugin.settings.image.width = width;
		this.plugin.settings.image.height = height;
		await this.saveParams();
		this.syncParamsControls();
	}

	renderGenParams(): void {
		this.syncParamsControls();
	}

	async refreshModels(): Promise<void> {
		try {
			const catalog = await this.plugin.api.image.fetchModels(this.imageUrl());
			this.modelCatalog = catalog.models;
			await this.applyModelFromCore();
			this.renderGenParams();
		} catch {
			this.modelCatalog = [];
		}
	}

	private async applyModelFromCore(): Promise<void> {
		const id = this.activeImageModelId();
		if (this.lastSyncedModelId === id) {
			this.updateLoraSectionVisibility();
			return;
		}
		const spec = this.availableModels().find((m) => m.id === id);
		this.lastSyncedModelId = id;
		if (spec) {
			this.plugin.settings.image.aspectRatio = "1:1";
			const { width, height } = sizesForAspect("1:1", spec.default_size);
			this.plugin.settings.image.width = width;
			this.plugin.settings.image.height = height;
			this.plugin.settings.image.steps = spec.default_steps;
			this.plugin.settings.image.cfg = spec.default_cfg;
			const loraStillOk = this.loraCatalog.find(
				(l) => l.id === this.plugin.settings.image.lora && l.compatible
			);
			if (!loraStillOk) this.plugin.settings.image.lora = "";
			await this.plugin.saveSettings();
			this.renderGenParams();
			await this.refreshLoras(false);
		}
		this.updateLoraSectionVisibility();
	}

	private activeImageModelId(): string {
		return this.plugin.api.switcher.getActiveModel("image");
	}

	private loraDirPath(): string {
		return this.plugin.api.modelPaths().loras;
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

		const url = this.imageUrl();
		const modelId = this.activeImageModelId();
		try {
			const catalog = await this.plugin.api.image.fetchLoras(modelId, verbose, url);
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
			const activeLora = compatible.find((l) => l.id === this.plugin.settings.image.lora);
			if (this.plugin.settings.image.lora && !activeLora) {
				this.plugin.settings.image.lora = "";
				await this.plugin.saveSettings();
			}
			this.renderLoraPicker();
			this.toggleLoraScaleField();
		} catch {
			this.loraCatalog = [];
			this.loraHintEl.removeClass("is-hidden");
			this.loraHintEl.setText("Start image server in Cybria AI → Servers to scan LoRAs");
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
		noneBtn.toggleClass("is-active", !this.plugin.settings.image.lora);
		noneBtn.onclick = () => void this.selectLora(LORA_NONE);

		for (const entry of this.loraCatalog.filter((l) => l.compatible)) {
			const btn = this.loraEl.createEl("button", {
				cls: "image-gen-lora-chip",
				text: entry.name,
			});
			btn.toggleClass("is-active", this.plugin.settings.image.lora === entry.id);
			btn.onclick = () => void this.selectLora(entry.id);
		}
	}

	private async selectLora(id: string): Promise<void> {
		this.plugin.settings.image.lora = id;
		await this.plugin.saveSettings();
		this.renderLoraPicker();
		this.toggleLoraScaleField();
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

	async checkHealth(_verbose: boolean): Promise<void> {
		const url = this.imageUrl();
		try {
			const h = await this.plugin.api.image.pingForGenerate(url);
			const ready = !!(h.ready_to_generate || h.ready);
			const loading = !!h.loading;
			const model = h.model ?? h.config?.model ?? DEFAULT_MODEL_LABEL;
			const parts = [
				ready ? "ready" : loading ? "loading" : "offline",
				model.split("/").pop() ?? model,
				h.device ?? "",
				h.max_side ? `${h.max_side}px` : "",
			].filter(Boolean);
			this.setStatusBar(parts.join(" · "), ready ? "ready" : loading ? "loading" : "error");
			if (ready) {
				void this.refreshModels();
				void this.refreshLoras(false);
			}
		} catch {
			this.setStatusBar("offline — Cybria AI → Servers", "error");
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
		} finally {
			this.busy = false;
			btn.setText("Generate");
			btn.disabled = false;
		}
	}

	renderOutput(highlightPath?: string): void {
		const records = this.plugin.settings.imageRecentOutputs;
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

		const file = this.plugin.app.vault.getAbstractFileByPath(latest.path);
		if (file instanceof TFile) {
			const frame = this.previewEl.createDiv({ cls: "image-gen-preview-frame" });
			const img = frame.createEl("img", { cls: "image-gen-preview-img" });
			img.alt = latest.prompt;
			img.title = `${latest.prompt}\nseed ${latest.seed}`;
			img.src = this.plugin.app.vault.getResourcePath(file);
			img.ondblclick = () => void this.plugin.app.workspace.openLinkText(latest.path, "", false);

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
						.onClick(() => void this.plugin.app.workspace.openLinkText(latest.path, "", false))
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
			const f = this.plugin.app.vault.getAbstractFileByPath(rec.path);
			if (!(f instanceof TFile)) continue;
			const thumb = grid.createDiv({ cls: "image-gen-thumb" });
			if (rec.path === latest.path) thumb.addClass("is-active");
			const timg = thumb.createEl("img");
			timg.src = this.plugin.app.vault.getResourcePath(f);
			timg.title = rec.prompt;
			thumb.onclick = () => this.renderOutput(rec.path);
		}
	}

	insertLink(path: string): void {
		const editor = this.plugin.app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(`![[${path}]]\n`);
			new Notice("Inserted image link");
		} else {
			new Notice("Open a note to insert the link");
		}
	}
}
