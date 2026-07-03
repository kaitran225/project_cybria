import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { AppsHost } from "./apps/AppsHost";
import { appTitle, APP_DEFS, type AppId } from "./apps/types";
import { CybriaDashboardPane } from "./dashboard";
import { CYBRIA_PORT } from "./servers";
import type CybriaCorePlugin from "./main";
import { ServersPanel } from "./servers-panel";
import { TerminalPanel } from "./terminal-panel";
import type { CoreViewTab } from "./settings";

export const VIEW_TYPE_MODEL_SWITCHER = "cybria-model-switcher";

export class ModelSwitcherView extends ItemView {
	private plugin: CybriaCorePlugin;
	private statusEl!: HTMLElement;
	private dashboardPane!: CybriaDashboardPane;
	private appsHost!: AppsHost;
	private serversPanel!: ServersPanel;
	private terminalPanel!: TerminalPanel;
	private workspaceEl!: HTMLElement;
	private dashboardTabBtn!: HTMLButtonElement;
	private appsTabBtn!: HTMLButtonElement;
	private appsTabLabel!: HTMLElement;
	private appsTabChevron!: HTMLElement;
	private appPickerEl!: HTMLElement;
	private appPickerBtns = new Map<AppId, HTMLButtonElement>();
	private appPickerOpen = false;
	private headerTitleEl!: HTMLElement;
	private serversTabBtn!: HTMLButtonElement;

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

	refreshModelSelectsForProfile(): void {
		this.serversPanel?.refreshModelSelectsForProfile();
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
		const serversPane = this.workspaceEl.createDiv("ccore-servers-pane");
		this.serversPanel = new ServersPanel(this.plugin, {
			onLog: (line) => this.plugin.api.appendLog(line),
			onGatewayChange: () => {
				this.dashboardPane?.render();
				this.updateGatewayHeader();
			},
			onServiceChange: () => {
				this.dashboardPane?.render();
				this.updateAppHeader();
			},
			setStatusText: (text, state) => this.setStatusText(text, state),
			refreshSwitcher: () => this.refreshSwitcher(),
			renderDashboard: () => this.dashboardPane?.render(),
		});
		this.serversPanel.build(serversPane);

		this.terminalPanel = new TerminalPanel(this.plugin);
		this.terminalPanel.build(this.workspaceEl);

		this.applyTab(this.plugin.settings.activeViewTab);
		if (this.plugin.settings.activeViewTab === "apps") {
			this.appsHost.showApp(this.plugin.settings.activeAppTab);
		}
		this.updateDynamicTabLabel();
		this.updateAppHeader();
		this.syncAppPickerSelection();

		this.plugin.api.switcher.onChange(() => {
			this.serversPanel?.syncServiceModelSelects();
			this.dashboardPane?.render();
			this.appsHost?.refreshSubtabs();
			this.updateAppHeader();
		});
		void this.refreshSwitcher();
	}

	async onClose(): Promise<void> {
		this.terminalPanel?.unmount();
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
		else if (tab === "servers") void this.serversPanel?.refreshStatuses();
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

	private setStatusText(text: string, state: "ready" | "loading" | "offline" | "neutral" = "neutral"): void {
		const dot = this.statusEl?.querySelector(".ccore-status-dot") as HTMLElement | null;
		const label = this.statusEl?.querySelector(".ccore-status-text") as HTMLElement | null;
		label?.setText(text);
		dot?.removeClass("is-ready", "is-loading", "is-offline");
		if (state !== "neutral") dot?.addClass(`is-${state}`);
	}

	private async refreshSwitcher(): Promise<void> {
		this.setStatusText("Refreshing…", "loading");
		try {
			await this.plugin.api.switcher.refresh();
			this.setStatusText("Status updated", "ready");
		} catch (e) {
			this.setStatusText(`Refresh failed: ${e instanceof Error ? e.message : e}`, "offline");
		}
		void this.serversPanel?.refreshStatuses();
		this.dashboardPane?.render();
	}
}
