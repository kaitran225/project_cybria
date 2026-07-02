import { setIcon } from "obsidian";
import type CybriaCorePlugin from "../main";
import { AudioPane } from "./audio/AudioPane";
import { ImageGenPane } from "./image/ImageGenPane";
import { LlmPane } from "./llm/LlmPane";
import { NovelPane } from "./novel/NovelPane";
import { APP_DEFS, type AppId, type AppPane } from "./types";

export class AppsHost {
	private root: HTMLElement | null = null;
	private hostEl!: HTMLElement;
	private subtabsEl!: HTMLElement;
	private subtabBtns = new Map<AppId, HTMLButtonElement>();
	private panes = new Map<AppId, AppPane>();
	private activeId: AppId | null = null;
	private onAppChange: ((id: AppId) => void) | null = null;

	constructor(private readonly plugin: CybriaCorePlugin) {
		this.panes.set("llm", new LlmPane(plugin));
		this.panes.set("novel", new NovelPane(plugin));
		this.panes.set("audio", new AudioPane(plugin));
		this.panes.set("image", new ImageGenPane(plugin));
	}

	setOnAppChange(fn: (id: AppId) => void): void {
		this.onAppChange = fn;
	}

	getLlmPane(): LlmPane {
		return this.panes.get("llm") as LlmPane;
	}

	getNovelPane(): NovelPane {
		return this.panes.get("novel") as NovelPane;
	}

	getAudioPane(): AudioPane {
		return this.panes.get("audio") as AudioPane;
	}

	getImagePane(): ImageGenPane {
		return this.panes.get("image") as ImageGenPane;
	}

	build(parent: HTMLElement): HTMLElement {
		const pane = parent.createDiv("ccore-pane ccore-apps-pane ccore-pane-hidden");
		this.root = pane;

		this.subtabsEl = pane.createDiv("ccore-app-subtabs");
		for (const def of APP_DEFS) {
			const btn = this.subtabsEl.createEl("button", { cls: "ccore-app-subtab" });
			setIcon(btn.createSpan("ccore-app-subtab-icon"), def.icon);
			btn.createSpan({ text: def.title, cls: "ccore-app-subtab-label" });
			btn.onclick = () => this.showApp(def.id);
			this.subtabBtns.set(def.id, btn);
		}

		this.hostEl = pane.createDiv("ccore-apps-host");
		return pane;
	}

	showApp(id: AppId): void {
		if (!this.hostEl) return;
		if (this.activeId === id) {
			this.panes.get(id)?.onShow();
			return;
		}
		if (this.activeId) {
			this.panes.get(this.activeId)?.unmount();
		}
		this.activeId = id;
		this.plugin.settings.activeAppTab = id;
		void this.plugin.saveSettings();

		for (const [appId, btn] of this.subtabBtns) {
			btn.toggleClass("is-active", appId === id);
		}

		this.hostEl.empty();
		const pane = this.panes.get(id);
		pane?.mount(this.hostEl);
		this.onAppChange?.(id);
	}

	unmount(): void {
		if (this.activeId) {
			this.panes.get(this.activeId)?.unmount();
			this.activeId = null;
		}
		this.root?.empty();
		this.root = null;
	}

	refreshSubtabs(): void {
		if (this.activeId) this.panes.get(this.activeId)?.onShow();
	}
}
