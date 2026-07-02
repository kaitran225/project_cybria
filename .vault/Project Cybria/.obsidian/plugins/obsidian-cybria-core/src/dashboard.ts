import { setIcon } from "obsidian";
import type CybriaCorePlugin from "./main";
import type { SlotState } from "./model-switcher";
import { APP_DEFS, type AppId } from "./apps/types";

export class CybriaDashboardPane {
	private gridEl!: HTMLElement;

	constructor(
		private readonly plugin: CybriaCorePlugin,
		private readonly onOpenApp: (id: AppId) => void
	) {}

	build(parent: HTMLElement): HTMLElement {
		const pane = parent.createDiv("ccore-pane ccore-dashboard-pane");
		this.gridEl = pane.createDiv("ccore-dash-grid");
		this.render();
		return pane;
	}

	render(): void {
		if (!this.gridEl) return;
		this.gridEl.empty();
		const switcher = this.plugin.api.switcher;

		for (const app of APP_DEFS) {
			const state = switcher.getState(app.slot);
			const card = this.gridEl.createDiv("ccore-dash-card");
			card.onclick = () => this.onOpenApp(app.id);

			const head = card.createDiv("ccore-dash-card-head");
			const iconEl = head.createSpan("ccore-dash-card-icon");
			setIcon(iconEl, app.icon);
			const titles = head.createDiv("ccore-dash-card-titles");
			titles.createDiv("ccore-dash-card-title").setText(app.title);
			titles.createSpan({
				cls: "ccore-dash-card-model",
				text: switcher.activeModelName(app.slot),
			});

			head.createSpan({
				cls: `ccore-dash-badge ccore-dash-badge-${state.status}`,
				text: this.statusLabel(state),
			});
		}
	}

	private statusLabel(state: SlotState): string {
		if (state.status === "loading") return "…";
		if (state.status === "ready") return "●";
		if (state.status === "error") return "!";
		return state.serverRunning ? "○" : "—";
	}
}
