import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { AppsHost } from "./apps/AppsHost";
import { appTitle, APP_DEFS, type AppId } from "./apps/types";
import { CybriaDashboardPane } from "./dashboard";
import { SLOT_LABELS, catalogForSlot, type ModelSlot } from "./catalog";
import type CybriaCorePlugin from "./main";
import type { SlotState } from "./model-switcher";
import { SERVICE_LABELS } from "./server-labels";
import {
	CYBRIA_PORT,
	SERVICE_TOOLS,
	type CybriaServiceKey,
} from "./servers";
import type { CoreViewTab } from "./settings";

export const VIEW_TYPE_MODEL_SWITCHER = "cybria-model-switcher";

const ALL_SERVICES: CybriaServiceKey[] = ["llm", "summarize", "tts", "image"];

export class ModelSwitcherView extends ItemView {
	private plugin: CybriaCorePlugin;
	private statusEl!: HTMLElement;
	private modelsPane!: HTMLElement;
	private serversPane!: HTMLElement;
	private dashboardPane!: CybriaDashboardPane;
	private appsHost!: AppsHost;
	private slotsEl!: HTMLElement;
	private serversEl!: HTMLElement;
	private terminalEl!: HTMLElement;
	private dashboardTabBtn!: HTMLButtonElement;
	private appsTabBtn!: HTMLButtonElement;
	private appsTabLabel!: HTMLElement;
	private appsTabChevron!: HTMLElement;
	private appPickerEl!: HTMLElement;
	private appPickerBtns = new Map<AppId, HTMLButtonElement>();
	private appPickerOpen = false;
	private headerTitleEl!: HTMLElement;
	private modelsTabBtn!: HTMLButtonElement;
	private serversTabBtn!: HTMLButtonElement;
	private unsubLog: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: CybriaCorePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MODEL_SWITCHER;
	}

	getDisplayText(): string {
		return "Cybria AI";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	showTab(tab: CoreViewTab, appId?: AppId): void {
		this.plugin.settings.activeViewTab = tab;
		if (appId) this.plugin.settings.activeAppTab = appId;
		void this.plugin.saveSettings();
		this.applyTab(tab);
		if (tab === "apps") {
			this.appsHost?.showApp(appId ?? this.plugin.settings.activeAppTab);
			if (appId) this.hideAppPicker();
		} else {
			this.hideAppPicker();
		}
		this.updateDynamicTabLabel();
		this.updateAppHeader();
	}

	getAppsHost(): AppsHost {
		return this.appsHost;
	}

	async onOpen(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("ccore-root");

		const header = root.createDiv("ccore-header");
		const titleBlock = header.createDiv("ccore-header-text");
		this.headerTitleEl = titleBlock.createDiv("ccore-header-title");
		this.headerTitleEl.setText("Cybria AI");
		this.statusEl = header.createDiv("ccore-status-wrap");
		this.statusEl.createDiv("ccore-status-dot");
		this.statusEl.createSpan({ cls: "ccore-status-text", text: "—" });

		const tabsWrap = root.createDiv("ccore-tabs-wrap");
		const tabs = tabsWrap.createDiv("ccore-tabs");
		this.dashboardTabBtn = tabs.createEl("button", { cls: "ccore-tab" });
		setIcon(this.dashboardTabBtn.createSpan("ccore-tab-icon"), "layout-dashboard");
		this.dashboardTabBtn.createSpan({ text: "Home", cls: "ccore-tab-label" });
		this.dashboardTabBtn.onclick = () => this.showTab("dashboard");
		this.appsTabBtn = tabs.createEl("button", { cls: "ccore-tab ccore-dynamic-tab" });
		this.appsTabBtn.onclick = () => this.onDynamicTabClick();
		const appsIcon = this.appsTabBtn.createSpan("ccore-tab-icon");
		setIcon(appsIcon, "bot");
		this.appsTabLabel = this.appsTabBtn.createSpan({ cls: "ccore-tab-label", text: "Chat" });
		this.appsTabChevron = this.appsTabBtn.createSpan("ccore-tab-chevron");
		setIcon(this.appsTabChevron, "chevron-down");
		this.modelsTabBtn = tabs.createEl("button", { cls: "ccore-tab" });
		setIcon(this.modelsTabBtn.createSpan("ccore-tab-icon"), "layers");
		this.modelsTabBtn.createSpan({ text: "Models", cls: "ccore-tab-label" });
		this.serversTabBtn = tabs.createEl("button", { cls: "ccore-tab" });
		setIcon(this.serversTabBtn.createSpan("ccore-tab-icon"), "server");
		this.serversTabBtn.createSpan({ text: "Servers", cls: "ccore-tab-label" });
		this.modelsTabBtn.onclick = () => this.showTab("models");
		this.serversTabBtn.onclick = () => this.showTab("servers");

		this.appPickerEl = tabsWrap.createDiv("ccore-app-picker");
		for (const def of APP_DEFS) {
			const btn = this.appPickerEl.createEl("button", { cls: "ccore-app-picker-item" });
			setIcon(btn.createSpan("ccore-app-picker-icon"), def.icon);
			btn.createSpan({ text: def.title, cls: "ccore-app-picker-label" });
			btn.onclick = () => {
				this.showTab("apps", def.id);
				this.hideAppPicker();
			};
			this.appPickerBtns.set(def.id, btn);
		}

		this.dashboardPane = new CybriaDashboardPane(this.plugin, (id) =>
			this.showTab("apps", id)
		);
		const dashEl = this.dashboardPane.build(root);
		dashEl.addClass("ccore-pane-hidden");

		this.appsHost = new AppsHost(this.plugin);
		this.appsHost.setOnAppChange((id) => {
			this.plugin.settings.activeAppTab = id;
			void this.plugin.saveSettings();
			this.updateDynamicTabLabel();
			this.updateAppHeader();
			this.syncAppPickerSelection();
			this.dashboardPane?.render();
		});
		this.appsHost.build(root);

		this.modelsPane = root.createDiv("ccore-pane ccore-pane-hidden");
		const actions = this.modelsPane.createDiv("ccore-actions");
		const refreshBtn = actions.createEl("button", { cls: "mod-cta ccore-primary-btn" });
		setIcon(refreshBtn.createSpan("ccore-btn-icon"), "refresh-cw");
		refreshBtn.createSpan({ text: "Refresh status", cls: "ccore-btn-label" });
		refreshBtn.onclick = () => void this.refresh();
		const loadBtn = actions.createEl("button", { text: "Load summarize", cls: "ccore-secondary-btn" });
		loadBtn.onclick = () => void this.loadLightModels();
		this.slotsEl = this.modelsPane.createDiv("ccore-slots");

		this.serversPane = root.createDiv("ccore-pane ccore-pane-hidden");
		this.serversEl = this.serversPane.createDiv("ccore-servers");
		this.buildServerCards();

		const termHead = root.createDiv("ccore-terminal-head");
		const termTitle = termHead.createDiv("ccore-terminal-title-wrap");
		setIcon(termTitle.createSpan("ccore-terminal-icon"), "terminal");
		termTitle.createSpan({ text: "Terminal", cls: "ccore-terminal-title" });
		termHead.createEl("button", { text: "Clear", cls: "ccore-secondary-btn" }).onclick = () => {
			this.plugin.api.log.clear();
			this.renderTerminal();
		};
		this.terminalEl = root.createDiv("ccore-terminal");
		this.terminalEl.style.height = `${this.plugin.settings.terminalHeight}px`;

		this.unsubLog = this.plugin.api.log.onLine(() => this.renderTerminal());
		this.renderTerminal();
		this.applyTab(this.plugin.settings.activeViewTab);
		if (this.plugin.settings.activeViewTab === "apps") {
			this.appsHost.showApp(this.plugin.settings.activeAppTab);
		}
		this.updateDynamicTabLabel();
		this.updateAppHeader();
		this.syncAppPickerSelection();

		this.plugin.api.switcher.onChange(() => {
			this.renderSlots();
			this.dashboardPane?.render();
			this.appsHost?.refreshSubtabs();
			this.updateAppHeader();
		});
		this.renderSlots();
		void this.refresh();
	}

	async onClose(): Promise<void> {
		this.unsubLog?.();
		this.unsubLog = null;
		this.appsHost?.unmount();
	}

	private onDynamicTabClick(): void {
		const onApps = this.plugin.settings.activeViewTab === "apps";
		if (onApps) {
			if (this.appPickerOpen) this.hideAppPicker();
			else this.showAppPicker();
			return;
		}
		this.showTab("apps");
		this.showAppPicker();
	}

	private showAppPicker(): void {
		if (!this.appPickerEl) return;
		this.appPickerOpen = true;
		this.appPickerEl.addClass("is-open");
		this.appsTabBtn.addClass("is-picker-open");
		this.syncAppPickerSelection();
	}

	private hideAppPicker(): void {
		if (!this.appPickerEl) return;
		this.appPickerOpen = false;
		this.appPickerEl.removeClass("is-open");
		this.appsTabBtn.removeClass("is-picker-open");
	}

	private syncAppPickerSelection(): void {
		const active = this.plugin.settings.activeAppTab;
		for (const [id, btn] of this.appPickerBtns) {
			btn.toggleClass("is-active", id === active);
		}
	}

	setPaneStatus(text: string, state: "ready" | "loading" | "offline" | "neutral" = "neutral"): void {
		if (this.plugin.settings.activeViewTab !== "apps") return;
		this.setStatusText(text, state);
	}

	private updateAppHeader(): void {
		if (!this.headerTitleEl) return;
		this.headerTitleEl.setText("Cybria AI");
		const tab = this.plugin.settings.activeViewTab;
		if (tab === "apps") {
			const def = APP_DEFS.find((a) => a.id === this.plugin.settings.activeAppTab);
			if (def) {
				this.setStatusText(this.plugin.api.switcher.activeModelName(def.slot), "neutral");
			}
			return;
		}
		if (tab === "dashboard") this.updateGatewayHeader();
	}

	private applyTab(tab: CoreViewTab): void {
		this.dashboardTabBtn.toggleClass("is-active", tab === "dashboard");
		this.appsTabBtn.toggleClass("is-active", tab === "apps");
		this.modelsTabBtn.toggleClass("is-active", tab === "models");
		this.serversTabBtn.toggleClass("is-active", tab === "servers");
		this.dashboardPane?.render();
		const dashPane = this.containerEl.querySelector(".ccore-dashboard-pane");
		dashPane?.toggleClass("ccore-pane-hidden", tab !== "dashboard");
		const appsPane = this.containerEl.querySelector(".ccore-apps-pane");
		appsPane?.toggleClass("ccore-pane-hidden", tab !== "apps");
		this.modelsPane.toggleClass("ccore-pane-hidden", tab !== "models");
		this.serversPane.toggleClass("ccore-pane-hidden", tab !== "servers");
		const showTerminal = tab === "models" || tab === "servers";
		this.containerEl.querySelector(".ccore-terminal-head")?.toggleClass("ccore-pane-hidden", !showTerminal);
		this.terminalEl?.toggleClass("ccore-pane-hidden", !showTerminal);
		if (tab === "dashboard") this.updateGatewayHeader();
		else if (tab === "models") this.setStatusText("Models", "neutral");
		this.updateAppHeader();
	}

	private updateDynamicTabLabel(): void {
		if (!this.appsTabLabel) return;
		const id = this.plugin.settings.activeAppTab;
		this.appsTabLabel.setText(appTitle(id));
		const iconEl = this.appsTabBtn?.querySelector(".ccore-tab-icon") as HTMLElement | null;
		if (iconEl) {
			const def = APP_DEFS.find((a) => a.id === id);
			if (def) setIcon(iconEl, def.icon);
		}
		this.appsTabBtn?.toggleClass("is-dimmed", this.plugin.settings.activeViewTab !== "apps");
	}

	private updateGatewayHeader(): void {
		const running = this.plugin.api.isGatewayRunning();
		this.setStatusText(
			running ? `:${CYBRIA_PORT} running` : `:${CYBRIA_PORT} stopped`,
			running ? "ready" : "offline"
		);
	}

	private renderTerminal(): void {
		if (!this.terminalEl) return;
		this.terminalEl.empty();
		for (const line of this.plugin.api.log.getLines()) {
			this.terminalEl.createDiv({ text: line, cls: "ccore-terminal-line" });
		}
		this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
	}

	private log(line: string): void {
		this.plugin.api.appendLog(line);
	}

	private buildServerCards(): void {
		this.serversEl.empty();

		const gw = this.serversEl.createDiv("ccore-server-card ccore-gateway-card");
		const gwHead = gw.createDiv("ccore-server-head");
		gwHead.createEl("h4", { text: "Cybria AI Server" });
		gwHead.createSpan({ text: ` : ${CYBRIA_PORT}`, cls: "ccore-server-port" });
		const gwStatus = gw.createDiv("ccore-server-status");
		gwStatus.setText(this.plugin.api.isGatewayRunning() ? "running" : "stopped");
		gwStatus.dataset.role = "gateway";

		const gwActions = gw.createDiv("ccore-actions");
		gwActions.createEl("button", { text: "Launch", cls: "mod-cta" }).onclick = () =>
			void this.launchGateway();
		gwActions.createEl("button", { text: "Stop" }).onclick = () => this.stopGateway();
		gwActions.createEl("button", { text: "Install gateway" }).onclick = () =>
			void this.installGateway();
		gwActions.createEl("button", { text: "Check all" }).onclick = () => void this.checkGateway();
		gw.createDiv("ccore-server-meta").setText(this.plugin.api.baseUrl());

		for (const service of ALL_SERVICES) {
			const card = this.serversEl.createDiv("ccore-server-card");
			const head = card.createDiv("ccore-server-head");
			head.createEl("h4", { text: SERVICE_LABELS[service] });
			head.createSpan({ text: ` /${service}`, cls: "ccore-server-port" });

			const actions = card.createDiv("ccore-actions");
			actions.createEl("button", { text: "Install deps" }).onclick = () =>
				void this.installServiceDeps(service);
			if (service === "llm") {
				actions.createEl("button", { text: "Download model" }).onclick = () =>
					void this.downloadLlmModel();
			}
			if (service === "summarize") {
				actions.createEl("button", { text: "Download model" }).onclick = () =>
					void this.downloadSummarizeModel();
			}
			if (service === "tts") {
				actions.createEl("button", { text: "Download model" }).onclick = () =>
					void this.downloadTtsModel();
				actions.createEl("button", { text: "Load model" }).onclick = () =>
					void this.loadTtsModel();
			}

			card.createDiv("ccore-server-meta").setText(this.plugin.api.serviceUrl(service));
		}
	}

	private refreshServerStatuses(): void {
		const gw = this.serversEl?.querySelector('[data-role="gateway"]') as HTMLElement | null;
		if (gw) {
			gw.setText(this.plugin.api.isGatewayRunning() ? "running" : "stopped");
		}
	}

	private async launchGateway(): Promise<void> {
		this.log(`# launch cybria-server :${CYBRIA_PORT}`);
		try {
			this.plugin.api
				.runner()
				.launchServer(this.plugin.api.resolveToolsDir("gateway"), (l) => this.log(l));
			new Notice("Cybria AI server starting");
			window.setTimeout(() => {
				this.refreshServerStatuses();
				this.dashboardPane?.render();
				this.updateGatewayHeader();
			}, 2000);
		} catch (e) {
			new Notice(`Launch failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private stopGateway(): void {
		this.log("# stop cybria-server");
		this.plugin.api.runner().stopServer((l) => this.log(l));
		this.refreshServerStatuses();
		this.dashboardPane?.render();
		this.updateGatewayHeader();
		void this.refresh();
	}

	private async installGateway(): Promise<void> {
		try {
			await this.plugin.api
				.runner()
				.installRequirements(this.plugin.api.resolveToolsDir("gateway"), (l) => this.log(l));
			new Notice("Gateway dependencies installed");
		} catch (e) {
			new Notice(`Install failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async checkGateway(): Promise<void> {
		try {
			const r = await this.plugin.api
				.runner()
				.checkRequirements(this.plugin.api.resolveToolsDir("gateway"), (l) => this.log(l));
			new Notice(r.ok ? "All environments OK" : `Issues: ${r.errors.join(", ")}`);
		} catch (e) {
			new Notice(`Check failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async installServiceDeps(service: CybriaServiceKey): Promise<void> {
		try {
			const subdir = SERVICE_TOOLS[service];
			await this.plugin.api
				.serviceRunner(subdir)
				.installRequirements(this.plugin.api.resolveToolsDir(service), (l) => this.log(l));
			new Notice(`${SERVICE_LABELS[service]} dependencies installed`);
		} catch (e) {
			new Notice(`Install failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async downloadLlmModel(): Promise<void> {
		const modelId = this.plugin.settings.activeModels.llm;
		try {
			await this.plugin.api
				.serviceRunner(SERVICE_TOOLS.llm)
				.downloadModel(this.plugin.api.resolveToolsDir("llm"), modelId, (l) => this.log(l));
			new Notice("LLM model download complete");
		} catch (e) {
			new Notice(`Download failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async downloadSummarizeModel(): Promise<void> {
		const modelId = this.plugin.settings.activeModels.summarize;
		try {
			await this.plugin.api.summarize.downloadModel(
				modelId,
				this.plugin.api.serviceUrl("summarize")
			);
			new Notice("Summarize model download started");
		} catch (e) {
			new Notice(`Download failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async downloadTtsModel(): Promise<void> {
		try {
			await this.plugin.api.tts.downloadModel(this.plugin.api.serviceUrl("tts"));
			new Notice("TTS model download started");
		} catch (e) {
			new Notice(`Download failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private async loadTtsModel(): Promise<void> {
		try {
			await this.plugin.api.tts.loadModel(this.plugin.api.serviceUrl("tts"));
			new Notice("TTS model loading");
		} catch (e) {
			new Notice(`Load failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private setStatusText(text: string, state: "ready" | "loading" | "offline" | "neutral" = "neutral"): void {
		const dot = this.statusEl?.querySelector(".ccore-status-dot") as HTMLElement | null;
		const label = this.statusEl?.querySelector(".ccore-status-text") as HTMLElement | null;
		label?.setText(text);
		dot?.removeClass("is-ready", "is-loading", "is-offline");
		if (state !== "neutral") dot?.addClass(`is-${state}`);
	}

	private async refresh(): Promise<void> {
		this.setStatusText("Refreshing…", "loading");
		try {
			await this.plugin.api.switcher.refresh();
			this.setStatusText("Status updated", "ready");
		} catch (e) {
			this.setStatusText(`Refresh failed: ${e instanceof Error ? e.message : e}`, "offline");
		}
		this.renderSlots();
		this.refreshServerStatuses();
		this.dashboardPane?.render();
	}

	private async loadLightModels(): Promise<void> {
		try {
			await this.plugin.api.switcher.activate(
				"summarize",
				this.plugin.settings.activeModels.summarize,
				{ ensureServer: true }
			);
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
			const serviceKey = (slot === "novel" ? "llm" : slot) as CybriaServiceKey;
			row.createSpan({
				text: `${this.plugin.api.serviceUrl(serviceKey)} · `,
				cls: "ccore-slot-meta",
			});
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
			await this.plugin.api.switcher.activate(slot, modelId, { ensureServer: true });
			new Notice(`${SLOT_LABELS[slot]}: ${modelId} loaded`);
		} catch (e) {
			new Notice(`Failed: ${e instanceof Error ? e.message : e}`);
		}
		this.renderSlots();
		this.refreshServerStatuses();
		this.dashboardPane?.render();
	}
}
