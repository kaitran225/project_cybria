import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { AppsHost } from "./apps/AppsHost";
import { appTitle, APP_DEFS, type AppId } from "./apps/types";
import { CybriaDashboardPane } from "./dashboard";
import { parseServiceHealth, formatStatusLabel, serviceHealthClass } from "./gateway-health";
import { catalogForSlot } from "./catalog";
import type CybriaCorePlugin from "./main";
import { SERVICE_BLURBS, SERVICE_ICONS, SERVICE_LABELS } from "./server-labels";
import {
	CYBRIA_PORT,
	SERVICE_SLOT,
	SERVICE_TOOLS,
	type CybriaServiceKey,
} from "./servers";
import { renderTerminalLine, shouldSkipTerminalLine } from "./terminal-ansi";
import type { CoreViewTab } from "./settings";

export const VIEW_TYPE_MODEL_SWITCHER = "cybria-model-switcher";

const ALL_SERVICES: CybriaServiceKey[] = ["llm", "summarize", "tts", "image"];

export class ModelSwitcherView extends ItemView {
	private plugin: CybriaCorePlugin;
	private statusEl!: HTMLElement;
	private serversPane!: HTMLElement;
	private dashboardPane!: CybriaDashboardPane;
	private appsHost!: AppsHost;
	private serversEl!: HTMLElement;
	private workspaceEl!: HTMLElement;
	private terminalBlockEl!: HTMLElement;
	private terminalEl!: HTMLElement;
	private gatewayProcEl!: HTMLElement;
	private gatewayApiEl!: HTMLElement;
	private serviceCards = new Map<
		CybriaServiceKey,
		{
			card: HTMLElement;
			dot: HTMLElement;
			status: HTMLElement;
			model: HTMLElement;
			hint: HTMLElement;
			select: HTMLSelectElement;
		}
	>();
	private dashboardTabBtn!: HTMLButtonElement;
	private appsTabBtn!: HTMLButtonElement;
	private appsTabLabel!: HTMLElement;
	private appsTabChevron!: HTMLElement;
	private appPickerEl!: HTMLElement;
	private appPickerBtns = new Map<AppId, HTMLButtonElement>();
	private appPickerOpen = false;
	private headerTitleEl!: HTMLElement;
	private serversTabBtn!: HTMLButtonElement;
	private unsubLog: (() => void) | null = null;
	private terminalRendered = 0;

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
		this.serversTabBtn = tabs.createEl("button", { cls: "ccore-tab" });
		setIcon(this.serversTabBtn.createSpan("ccore-tab-icon"), "server");
		this.serversTabBtn.createSpan({ text: "Servers", cls: "ccore-tab-label" });
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

		this.workspaceEl = root.createDiv("ccore-workspace ccore-pane-hidden");
		this.serversPane = this.workspaceEl.createDiv("ccore-servers-pane");
		this.serversEl = this.serversPane.createDiv("ccore-servers");
		this.buildServerCards();

		this.terminalBlockEl = this.workspaceEl.createDiv("ccore-terminal-block");
		const termHead = this.terminalBlockEl.createDiv("ccore-terminal-head");
		const termTitle = termHead.createDiv("ccore-terminal-title-wrap");
		setIcon(termTitle.createSpan("ccore-terminal-icon"), "terminal");
		termTitle.createSpan({ text: "Terminal", cls: "ccore-terminal-title" });
		termHead.createEl("button", { text: "Clear", cls: "ccore-secondary-btn" }).onclick = () => {
			this.plugin.api.log.clear();
			this.renderTerminal();
		};
		this.terminalEl = this.terminalBlockEl.createDiv("ccore-terminal");

		this.unsubLog = this.plugin.api.log.onLine(() => this.appendTerminalLine());
		this.renderTerminal();
		this.applyTab(this.plugin.settings.activeViewTab);
		if (this.plugin.settings.activeViewTab === "apps") {
			this.appsHost.showApp(this.plugin.settings.activeAppTab);
		}
		this.updateDynamicTabLabel();
		this.updateAppHeader();
		this.syncAppPickerSelection();

		this.plugin.api.switcher.onChange(() => {
			this.syncServiceModelSelects();
			this.dashboardPane?.render();
			this.appsHost?.refreshSubtabs();
			this.updateAppHeader();
		});
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
		this.serversTabBtn.toggleClass("is-active", tab === "servers");
		this.dashboardPane?.render();
		const dashPane = this.containerEl.querySelector(".ccore-dashboard-pane");
		dashPane?.toggleClass("ccore-pane-hidden", tab !== "dashboard");
		const appsPane = this.containerEl.querySelector(".ccore-apps-pane");
		appsPane?.toggleClass("ccore-pane-hidden", tab !== "apps");
		this.workspaceEl?.toggleClass("ccore-pane-hidden", tab !== "servers");
		if (tab === "dashboard") this.updateGatewayHeader();
		else if (tab === "servers") void this.refreshServerStatuses();
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

	private appendTerminalLine(): void {
		if (!this.terminalEl) return;
		const lines = this.plugin.api.log.getLines();
		while (this.terminalRendered < lines.length) {
			const line = lines[this.terminalRendered]!;
			this.terminalRendered++;
			if (shouldSkipTerminalLine(line)) continue;
			renderTerminalLine(this.terminalEl, line);
		}
		this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
	}

	private renderTerminal(): void {
		if (!this.terminalEl) return;
		this.terminalEl.empty();
		this.terminalRendered = 0;
		this.appendTerminalLine();
	}

	private log(line: string): void {
		this.plugin.api.appendLog(line);
	}

	private buildServerCards(): void {
		this.serversEl.empty();
		this.serviceCards.clear();

		const gw = this.serversEl.createDiv("ccore-server-card ccore-gateway-card");
		const gwHead = gw.createDiv("ccore-server-head");
		gwHead.createEl("h4", { text: "Cybria Gateway" });
		gwHead.createSpan({ text: ` :${CYBRIA_PORT}`, cls: "ccore-server-port" });
		gw.createDiv({
			cls: "ccore-server-desc",
			text: "Launch starts the gateway only. Use Start on each service card to run LLM, Summarize, TTS, or Image.",
		});

		const gwStatusRow = gw.createDiv("ccore-server-status-row");
		this.gatewayProcEl = gwStatusRow.createSpan({ cls: "ccore-server-pill ccore-svc-stopped", text: "process: —" });
		this.gatewayApiEl = gwStatusRow.createSpan({ cls: "ccore-server-pill ccore-svc-stopped", text: "API: —" });

		const gwActions = gw.createDiv("ccore-actions");
		gwActions.createEl("button", { text: "Launch gateway", cls: "mod-cta" }).onclick = () =>
			void this.launchGateway();
		gwActions.createEl("button", { text: "Stop gateway", cls: "ccore-secondary-btn" }).onclick = () =>
			this.stopGateway();
		gwActions.createEl("button", { text: "Install deps", cls: "ccore-secondary-btn" }).onclick = () =>
			void this.installGateway();
		gwActions.createEl("button", { text: "Check all", cls: "ccore-secondary-btn" }).onclick = () =>
			void this.checkGateway();
		gwActions.createEl("button", { text: "Refresh status", cls: "ccore-secondary-btn" }).onclick = () =>
			void this.refresh();
		gw.createDiv("ccore-server-meta").setText(this.plugin.api.baseUrl());

		const grid = this.serversEl.createDiv("ccore-svc-grid");
		for (const service of ALL_SERVICES) {
			const slot = SERVICE_SLOT[service];
			const card = grid.createDiv("ccore-svc-card");
			const top = card.createDiv("ccore-svc-card-top");
			const titleWrap = top.createDiv("ccore-svc-title-wrap");
			const iconEl = titleWrap.createSpan("ccore-svc-icon");
			setIcon(iconEl, SERVICE_ICONS[service]);
			const titles = titleWrap.createDiv("ccore-svc-titles");
			titles.createDiv("ccore-svc-title").setText(SERVICE_LABELS[service]);
			titles.createDiv("ccore-svc-blurb").setText(SERVICE_BLURBS[service]);

			const statusWrap = top.createDiv("ccore-svc-status-wrap");
			const dot = statusWrap.createSpan("ccore-svc-dot");
			const status = statusWrap.createSpan({ cls: "ccore-svc-pill ccore-svc-offline", text: "—" });

			const body = card.createDiv("ccore-svc-card-body");
			const modelRow = body.createDiv("ccore-svc-model-row");
			modelRow.createSpan({ text: "Model", cls: "ccore-svc-model-label" });
			const select = modelRow.createEl("select", { cls: "ccore-svc-model-select" });
			for (const m of catalogForSlot(slot)) {
				const opt = select.createEl("option", { text: m.name, value: m.id });
				if (m.runnable === "tight") opt.text = `${m.name} (tight)`;
			}
			select.value = this.plugin.settings.activeModels[slot];
			select.onchange = () => {
				this.plugin.settings.activeModels[slot] = select.value;
				void this.plugin.saveSettings();
			};

			const model = body.createDiv({ cls: "ccore-svc-model is-hidden", text: "" });
			const hint = body.createDiv({ cls: "ccore-svc-hint is-hidden", text: "" });
			this.serviceCards.set(service, { card, dot, status, model, hint, select });

			const actions = card.createDiv("ccore-svc-actions");
			const primary = actions.createDiv("ccore-svc-actions-primary");
			primary.createEl("button", { text: "Start", cls: "ccore-svc-btn ccore-svc-btn-start" }).onclick =
				() => void this.startService(service);
			primary.createEl("button", { text: "Stop", cls: "ccore-svc-btn ccore-svc-btn-stop" }).onclick =
				() => void this.stopService(service);

			const tools = actions.createDiv("ccore-svc-actions-tools");
			tools.createEl("button", { text: "Install", cls: "ccore-svc-btn ccore-svc-btn-tool" }).onclick =
				() => void this.installServiceDeps(service);
			if (service === "llm") {
				tools.createEl("button", { text: "Download", cls: "ccore-svc-btn ccore-svc-btn-tool" }).onclick =
					() => void this.downloadLlmModel();
			}
			if (service === "summarize") {
				tools.createEl("button", { text: "Download", cls: "ccore-svc-btn ccore-svc-btn-tool" }).onclick =
					() => void this.downloadSummarizeModel();
			}
			if (service === "tts") {
				tools.createEl("button", { text: "Download", cls: "ccore-svc-btn ccore-svc-btn-tool" }).onclick =
					() => void this.downloadTtsModel();
			}

			card.createDiv("ccore-svc-url").setText(this.plugin.api.serviceUrl(service));
		}

		void this.refreshServerStatuses();
	}

	private async refreshServerStatuses(): Promise<void> {
		const localProc = this.plugin.api.isGatewayRunning();
		this.gatewayProcEl?.setText(localProc ? "process: running" : "process: stopped");
		this.gatewayProcEl?.removeClass("ccore-svc-ready", "ccore-svc-stopped");
		this.gatewayProcEl?.addClass(localProc ? "ccore-svc-ready" : "ccore-svc-stopped");

		const health = await this.plugin.api.fetchGatewayHealth();
		this.gatewayApiEl?.setText(health ? "API: online" : "API: offline");
		this.gatewayApiEl?.removeClass("ccore-svc-ready", "ccore-svc-stopped", "ccore-svc-offline");
		this.gatewayApiEl?.addClass(health ? "ccore-svc-ready" : localProc ? "ccore-svc-loading" : "ccore-svc-offline");

		for (const service of ALL_SERVICES) {
			const els = this.serviceCards.get(service);
			if (!els) continue;
			const parsed = parseServiceHealth(health?.services?.[service]);
			if (!health && !localProc) {
				this.paintServiceCard(els, {
					state: "offline",
					label: "offline",
					model: "—",
					detail: "Launch gateway first",
				});
				continue;
			}
			if (!health && localProc) {
				this.paintServiceCard(els, {
					state: "loading",
					label: "starting",
					model: "—",
					detail: "Gateway warming up…",
				});
				continue;
			}
			this.paintServiceCard(els, parsed);
		}
	}

	private paintServiceCard(
		els: { card: HTMLElement; dot: HTMLElement; status: HTMLElement; model: HTMLElement; hint: HTMLElement },
		parsed: ReturnType<typeof parseServiceHealth>
	): void {
		els.card.removeClass(
			"is-offline",
			"is-stopped",
			"is-loading",
			"is-ready",
			"is-error"
		);
		els.card.addClass(`is-${parsed.state === "stopped" ? "idle" : parsed.state}`);

		els.status.setText(formatStatusLabel(parsed.label));
		els.status.removeClass(
			"ccore-svc-offline",
			"ccore-svc-stopped",
			"ccore-svc-loading",
			"ccore-svc-ready",
			"ccore-svc-error"
		);
		els.status.addClass(serviceHealthClass(parsed.state));

		els.dot.removeClass("is-ready", "is-loading", "is-offline", "is-error");
		if (parsed.state === "ready") els.dot.addClass("is-ready");
		else if (parsed.state === "loading") els.dot.addClass("is-loading");
		else if (parsed.state === "error") els.dot.addClass("is-error");
		else els.dot.addClass("is-offline");

		const hasModel = parsed.model && parsed.model !== "—";
		els.model.toggleClass("is-hidden", !hasModel);
		if (hasModel) els.model.setText(parsed.model);

		els.hint.removeClass("is-visible", "is-info", "is-warn", "is-error");
		if (parsed.detail) {
			els.hint.setText(parsed.detail);
			els.hint.addClass("is-visible");
			if (parsed.state === "error") els.hint.addClass("is-error");
			else if (parsed.state === "loading") els.hint.addClass("is-info");
			else if (parsed.state === "offline") els.hint.addClass("is-warn");
			else els.hint.addClass("is-info");
		}
	}

	private syncServiceModelSelects(): void {
		for (const service of ALL_SERVICES) {
			const els = this.serviceCards.get(service);
			if (!els) continue;
			const slot = SERVICE_SLOT[service];
			const active = this.plugin.settings.activeModels[slot];
			if (els.select.value !== active) els.select.value = active;
		}
	}

	private selectedModelId(service: CybriaServiceKey): string {
		const els = this.serviceCards.get(service);
		if (els?.select.value) return els.select.value;
		return this.plugin.settings.activeModels[SERVICE_SLOT[service]];
	}

	private async ensureGatewayRunning(): Promise<void> {
		if (this.plugin.api.isGatewayRunning()) return;
		if (await this.plugin.api.fetchGatewayHealth()) {
			this.log(`[start] using gateway already running on :${CYBRIA_PORT}`);
			return;
		}
		this.log(`[start] gateway not running — launching on :${CYBRIA_PORT}`);
		this.plugin.api
			.runner()
			.launchServer(this.plugin.api.resolveToolsDir("gateway"), (l) => this.log(l));
		const deadline = Date.now() + 30_000;
		while (Date.now() < deadline) {
			await new Promise((r) => setTimeout(r, 1000));
			if (await this.plugin.api.fetchGatewayHealth()) {
				this.log(`[start] gateway is up`);
				return;
			}
		}
		throw new Error("gateway did not come up within 30s — check logs above");
	}

	private async startService(service: CybriaServiceKey): Promise<void> {
		const slot = SERVICE_SLOT[service];
		const modelId = this.selectedModelId(service);
		this.plugin.settings.activeModels[slot] = modelId;
		void this.plugin.saveSettings();

		this.log(`# start ${SERVICE_LABELS[service]} with ${modelId}`);
		this.setStatusText(`Starting ${SERVICE_LABELS[service]}…`, "loading");
		try {
			await this.ensureGatewayRunning();

			this.log(`[start] requesting ${service} process…`);
			const res = await this.plugin.api.startService(service);
			if (!res.ok) {
				this.log(`[start] ${service} failed to start: ${res.error ?? "unknown error"}`);
				new Notice(`${SERVICE_LABELS[service]} failed: ${res.error ?? "unknown"}`);
				return;
			}
			this.log(`[start] ${service} process healthy — loading ${modelId}`);
			await this.plugin.api.switcher.activate(slot, modelId, {
				ensureServer: false,
				onLog: (l) => this.log(l),
			});
			this.log(`[start] ${SERVICE_LABELS[service]} ready with ${modelId}`);
			new Notice(`${SERVICE_LABELS[service]} started with ${modelId}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.log(`[start] failed: ${msg}`);
			new Notice(`Start failed: ${msg}`);
		} finally {
			await this.refreshServerStatuses();
			void this.refresh();
		}
	}

	private async stopService(service: CybriaServiceKey): Promise<void> {
		this.log(`# stop service ${service}`);
		await this.plugin.api.stopService(service);
		new Notice(`${SERVICE_LABELS[service]} stopped`);
		await this.refreshServerStatuses();
		void this.refresh();
	}

	private async launchGateway(): Promise<void> {
		this.log(`# launch cybria-server :${CYBRIA_PORT}`);
		if (!this.plugin.api.isGatewayRunning()) {
			const existing = await this.plugin.api.fetchGatewayHealth();
			if (existing) {
				this.log(
					`[gateway] port ${CYBRIA_PORT} already answering — an external gateway is running. Stop it or restart Obsidian before launching a new one.`
				);
				new Notice("Gateway already running on :2253");
				await this.refreshServerStatuses();
				return;
			}
		}
		try {
			this.plugin.api
				.runner()
				.launchServer(this.plugin.api.resolveToolsDir("gateway"), (l) => this.log(l));
			new Notice("Cybria AI server starting");
			window.setTimeout(() => {
				void this.refreshServerStatuses();
				this.dashboardPane?.render();
				this.updateGatewayHeader();
			}, 2000);
		} catch (e) {
			this.log(`[gateway] launch failed: ${e instanceof Error ? e.message : e}`);
			new Notice(`Launch failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private stopGateway(): void {
		this.log("# stop cybria-server");
		this.plugin.api.runner().stopServer((l) => this.log(l));
		void this.refreshServerStatuses();
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
		const modelId = this.selectedModelId("llm");
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
		const modelId = this.selectedModelId("summarize");
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
			const modelId = this.selectedModelId("tts");
			await this.plugin.api.tts.downloadModel(modelId, this.plugin.api.serviceUrl("tts"));
			new Notice("TTS model download started");
		} catch (e) {
			new Notice(`Download failed: ${e instanceof Error ? e.message : e}`);
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
		void this.refreshServerStatuses();
		this.dashboardPane?.render();
	}
}
