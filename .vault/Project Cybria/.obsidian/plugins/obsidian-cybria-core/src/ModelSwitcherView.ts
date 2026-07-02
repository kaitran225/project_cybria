import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { SLOT_LABELS, catalogForSlot, type ModelSlot } from "./catalog";
import type CybriaCorePlugin from "./main";
import type { SlotState } from "./model-switcher";

export const VIEW_TYPE_MODEL_SWITCHER = "cybria-model-switcher";

export class ModelSwitcherView extends ItemView {
	private plugin: CybriaCorePlugin;
	private statusEl!: HTMLElement;
	private slotsEl!: HTMLElement;
	private terminalEl!: HTMLElement;
	private terminalLines: string[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: CybriaCorePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MODEL_SWITCHER;
	}

	getDisplayText(): string {
		return "Cybria Models";
	}

	getIcon(): string {
		return "cpu";
	}

	async onOpen(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("ccore-root");

		root.createEl("p", {
			cls: "ccore-hint",
			text: "8GB VRAM: only one heavy model (LLM / Image / TTS) at a time. Summarization is lightweight.",
		});

		this.statusEl = root.createDiv("ccore-status");
		const actions = root.createDiv("ccore-actions");
		actions.createEl("button", { text: "Refresh status", cls: "mod-cta" }).onclick = () =>
			void this.refresh();
		actions.createEl("button", { text: "Load all light" }).onclick = () =>
			void this.loadLightModels();

		this.slotsEl = root.createDiv("ccore-slots");
		this.terminalEl = root.createDiv("ccore-terminal");

		this.plugin.api.switcher.onChange(() => this.renderSlots());
		this.renderSlots();
		void this.refresh();
	}

	private log(line: string): void {
		this.terminalLines.push(line);
		if (this.terminalLines.length > 300) this.terminalLines.shift();
		if (this.terminalEl) {
			this.terminalEl.empty();
			for (const l of this.terminalLines) {
				this.terminalEl.createDiv({ text: l, cls: "ccore-terminal-line" });
			}
			this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
		}
	}

	private async refresh(): Promise<void> {
		this.statusEl.setText("Refreshing…");
		try {
			await this.plugin.api.switcher.refresh();
			this.statusEl.setText("Status updated");
		} catch (e) {
			this.statusEl.setText(`Refresh failed: ${e instanceof Error ? e.message : e}`);
		}
		this.renderSlots();
	}

	private async loadLightModels(): Promise<void> {
		try {
			await this.plugin.api.switcher.activate("summarize", this.plugin.settings.activeModels.summarize, {
				ensureServer: true,
				onLog: (l) => this.log(l),
			});
			new Notice("Summarization model loaded");
		} catch (e) {
			new Notice(`Load failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private renderSlots(): void {
		if (!this.slotsEl) return;
		this.slotsEl.empty();
		const switcher = this.plugin.api.switcher;

		for (const slot of switcher.listSlots()) {
			const state = switcher.getState(slot);
			const section = this.slotsEl.createDiv("ccore-slot");
			const head = section.createDiv("ccore-slot-head");
			head.createEl("span", { text: SLOT_LABELS[slot], cls: "ccore-slot-title" });
			head.createEl("span", {
				text: this.statusLabel(state),
				cls: `ccore-slot-badge ccore-badge-${state.status}`,
			});

			const active = catalogForSlot(slot).find((m) => m.id === state.activeModelId);
			if (active?.note) {
				section.createDiv({ text: active.note, cls: "ccore-slot-note" });
			}

			const pills = section.createDiv("ccore-pills");
			for (const m of catalogForSlot(slot)) {
				const btn = pills.createEl("button", {
					text: m.name,
					cls: "ccore-pill",
				});
				if (m.id === state.activeModelId) btn.addClass("is-active");
				if (m.runnable === "tight") btn.addClass("is-tight");
				btn.onclick = () => void this.activateSlot(slot, m.id);
			}

			const row = section.createDiv("ccore-slot-actions");
			const server = this.plugin.api.switcher.serverUrl(
				slot === "novel" ? "llm" : slot
			);
			row.createSpan({ text: `${server} · `, cls: "ccore-slot-meta" });
			row.createSpan({
				text: state.serverRunning ? "server running" : "server stopped",
				cls: state.serverRunning ? "ccore-meta-ok" : "ccore-meta-off",
			});
		}
	}

	private statusLabel(state: SlotState): string {
		if (state.status === "loading") return "loading…";
		if (state.status === "ready") {
			return state.loadedModelId === state.activeModelId ? "ready" : "ready (other loaded)";
		}
		if (state.status === "error") return "error";
		return state.serverRunning ? "idle" : "offline";
	}

	private async activateSlot(slot: ModelSlot, modelId: string): Promise<void> {
		this.log(`# activate ${slot} → ${modelId}`);
		try {
			await this.plugin.api.switcher.activate(slot, modelId, {
				ensureServer: true,
				onLog: (l) => this.log(l),
			});
			new Notice(`${SLOT_LABELS[slot]}: ${modelId} loaded`);
		} catch (e) {
			new Notice(`Failed: ${e instanceof Error ? e.message : e}`);
		}
		this.renderSlots();
	}
}
