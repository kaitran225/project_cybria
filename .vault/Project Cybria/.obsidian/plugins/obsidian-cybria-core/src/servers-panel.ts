import { Notice, setIcon } from "obsidian";
import { parseServiceHealth, formatStatusLabel, serviceHealthClass } from "./gateway-health";
import { catalogForProfile } from "./hardware-profiles";
import type { ModelSlot } from "./catalog";
import type CybriaCorePlugin from "./main";
import { SERVICE_BLURBS, SERVICE_ICONS, SERVICE_LABELS } from "./server-labels";
import {
	ALL_SERVICES,
	CYBRIA_PORT,
	SERVICE_PATHS,
	SERVICE_SLOT,
	SERVICE_TOOLS,
	type CybriaServiceKey,
} from "./servers";

export interface ServersPanelCallbacks {
	onLog: (line: string) => void;
	onGatewayChange: () => void;
	onServiceChange: () => void;
	setStatusText: (text: string, state: "ready" | "loading" | "offline" | "neutral") => void;
	refreshSwitcher: () => Promise<void>;
	renderDashboard: () => void;
}

export class ServersPanel {
	private serversEl!: HTMLElement;
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

	constructor(
		private readonly plugin: CybriaCorePlugin,
		private readonly callbacks: ServersPanelCallbacks
	) {}

	build(host: HTMLElement): void {
		this.serversEl = host.createDiv("ccore-servers");
		this.buildServerCards();
	}

	private log(line: string): void {
		this.callbacks.onLog(line);
	}

	private logMultiline(prefix: string, message: string): void {
		const lines = message.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
		if (lines.length === 0) {
			this.log(prefix);
			return;
		}
		this.log(`${prefix} ${lines[0]}`);
		for (const line of lines.slice(1)) {
			this.log(`  ${line}`);
		}
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
		this.gatewayProcEl = gwStatusRow.createSpan({
			cls: "ccore-server-pill ccore-svc-stopped",
			text: "process: —",
		});
		this.gatewayApiEl = gwStatusRow.createSpan({
			cls: "ccore-server-pill ccore-svc-stopped",
			text: "API: —",
		});

		const gwActions = gw.createDiv("ccore-actions");
		gwActions.createEl("button", { text: "Launch gateway", cls: "mod-cta" }).onclick = () =>
			void this.launchGateway();
		gwActions.createEl("button", { text: "Stop gateway", cls: "ccore-secondary-btn" }).onclick = () =>
			this.stopGateway();
		gwActions.createEl("button", { text: "Install deps", cls: "ccore-secondary-btn" }).onclick = () =>
			void this.installGateway();
		gwActions.createEl("button", { text: "Check all", cls: "ccore-secondary-btn" }).onclick = () =>
			void this.checkGateway();
		gwActions.createEl("button", { text: "Refresh status", cls: "ccore-secondary-btn" }).onclick =
			() => void this.refreshStatuses();
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
			const titleEl = titles.createDiv("ccore-svc-title");
			titleEl.setText(SERVICE_LABELS[service]);
			titleEl.setAttr("title", SERVICE_BLURBS[service]);

			const statusWrap = top.createDiv("ccore-svc-status-wrap");
			const dot = statusWrap.createSpan("ccore-svc-dot");
			const status = statusWrap.createSpan({ cls: "ccore-svc-pill ccore-svc-offline", text: "—" });

			const body = card.createDiv("ccore-svc-card-body");
			const modelRow = body.createDiv("ccore-svc-model-row");
			modelRow.createSpan({ text: "Model", cls: "ccore-svc-model-label" });
			const select = modelRow.createEl("select", { cls: "ccore-svc-model-select" });
			this.populateModelSelect(select, slot);
			select.value = this.plugin.settings.activeModels[slot];
			select.onchange = () => {
				this.plugin.settings.activeModels[slot] = select.value;
				void this.plugin.saveSettings();
			};

			const model = body.createDiv({ cls: "ccore-svc-model is-hidden", text: "" });
			const hint = body.createDiv({ cls: "ccore-svc-hint is-hidden", text: "" });
			this.serviceCards.set(service, { card, dot, status, model, hint, select });

			const actions = card.createDiv("ccore-svc-actions");
			const btnRow = actions.createDiv("ccore-svc-actions-row");
			btnRow.createEl("button", { text: "Start", cls: "ccore-svc-btn ccore-svc-btn-start" }).onclick =
				() => void this.startService(service);
			btnRow.createEl("button", { text: "Stop", cls: "ccore-svc-btn ccore-svc-btn-stop" }).onclick =
				() => void this.stopService(service);
			btnRow.createEl("button", { text: "Install", cls: "ccore-svc-btn ccore-svc-btn-tool" }).onclick =
				() => void this.installServiceDeps(service);
			if (service === "llm" || service === "summarize" || service === "tts") {
				btnRow.createEl("button", { text: "Download", cls: "ccore-svc-btn ccore-svc-btn-tool" }).onclick =
					() => void this.downloadModel(service);
			}

			const urlEl = card.createDiv("ccore-svc-url");
			urlEl.setAttr("title", this.plugin.api.serviceUrl(service));
			urlEl.setText(`:${CYBRIA_PORT}${SERVICE_PATHS[service]}`);
		}

		void this.refreshStatuses();
	}

	async refreshStatuses(): Promise<void> {
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
		els.card.removeClass("is-offline", "is-stopped", "is-loading", "is-ready", "is-error");
		els.card.addClass(`is-${parsed.state === "stopped" ? "idle" : parsed.state}`);
		els.card.toggleAttribute("aria-busy", parsed.state === "loading");

		const label = formatStatusLabel(parsed.label);
		els.dot.setAttr("title", parsed.detail ? `${label} — ${parsed.detail}` : label);
		els.dot.removeClass("is-ready", "is-loading", "is-offline", "is-error");
		if (parsed.state === "ready") els.dot.addClass("is-ready");
		else if (parsed.state === "loading") els.dot.addClass("is-loading");
		else if (parsed.state === "error") els.dot.addClass("is-error");
		else els.dot.addClass("is-offline");

		els.status.removeClass(
			"ccore-svc-offline",
			"ccore-svc-stopped",
			"ccore-svc-loading",
			"ccore-svc-ready",
			"ccore-svc-error",
			"is-hidden"
		);
		if (parsed.state === "loading") {
			els.status.addClass("is-hidden");
			els.status.setText("");
		} else {
			els.status.setText(label);
			els.status.addClass(serviceHealthClass(parsed.state));
		}

		els.model.addClass("is-hidden");

		els.hint.removeClass("is-visible", "is-info", "is-warn", "is-error");
		if (parsed.detail && parsed.state !== "ready") {
			els.hint.setText(parsed.detail);
			els.hint.addClass("is-visible");
			if (parsed.state === "error") els.hint.addClass("is-error");
			else if (parsed.state === "loading") els.hint.addClass("is-info");
			else if (parsed.state === "offline") els.hint.addClass("is-warn");
			else els.hint.addClass("is-info");
		}
	}

	syncServiceModelSelects(): void {
		for (const service of ALL_SERVICES) {
			const els = this.serviceCards.get(service);
			if (!els) continue;
			const slot = SERVICE_SLOT[service];
			const active = this.plugin.settings.activeModels[slot];
			if (els.select.value !== active) els.select.value = active;
		}
	}

	private populateModelSelect(select: HTMLSelectElement, slot: ModelSlot): void {
		select.empty();
		const profileId = this.plugin.settings.hardwareProfile;
		for (const m of catalogForProfile(slot, profileId)) {
			const opt = select.createEl("option", { text: m.name, value: m.id });
			if (m.runnable === "tight") opt.text = `${m.name} (tight)`;
			else if (m.runnable === "marginal") opt.text = `${m.name} (marginal)`;
		}
		const active = this.plugin.settings.activeModels[slot];
		if (Array.from(select.options).some((o) => o.value === active)) {
			select.value = active;
		} else if (select.options.length > 0) {
			select.value = select.options[0].value;
		}
	}

	refreshModelSelectsForProfile(): void {
		for (const service of ALL_SERVICES) {
			const els = this.serviceCards.get(service);
			if (!els) continue;
			this.populateModelSelect(els.select, SERVICE_SLOT[service]);
		}
		this.callbacks.renderDashboard();
	}

	private selectedModelId(service: CybriaServiceKey): string {
		const els = this.serviceCards.get(service);
		if (els?.select.value) return els.select.value;
		return this.plugin.settings.activeModels[SERVICE_SLOT[service]];
	}

	private async ensureGatewayRunning(): Promise<void> {
		await this.plugin.api.ensureGatewayRunning({ onLog: (l) => this.log(l) });
	}

	private async startService(service: CybriaServiceKey): Promise<void> {
		const slot = SERVICE_SLOT[service];
		const modelId = this.selectedModelId(service);
		this.plugin.settings.activeModels[slot] = modelId;
		void this.plugin.saveSettings();

		this.log(`# start ${SERVICE_LABELS[service]} with ${modelId}`);
		this.callbacks.setStatusText(`Starting ${SERVICE_LABELS[service]}…`, "loading");
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
			this.logMultiline("[start] failed:", msg);
			new Notice(`Start failed: ${msg.split("\n")[0]}`);
		} finally {
			await this.refreshStatuses();
			await this.callbacks.refreshSwitcher();
			this.callbacks.onServiceChange();
		}
	}

	private async stopService(service: CybriaServiceKey): Promise<void> {
		this.log(`# stop service ${service}`);
		await this.plugin.api.stopService(service);
		new Notice(`${SERVICE_LABELS[service]} stopped`);
		await this.refreshStatuses();
		await this.callbacks.refreshSwitcher();
		this.callbacks.onServiceChange();
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
				await this.refreshStatuses();
				return;
			}
		}
		try {
			await this.plugin.api.ensureGatewayRunning({ onLog: (l) => this.log(l) });
			new Notice("Cybria AI server running");
			await this.refreshStatuses();
			this.callbacks.onGatewayChange();
		} catch (e) {
			this.log(`[gateway] launch failed: ${e instanceof Error ? e.message : e}`);
			new Notice(`Launch failed: ${e instanceof Error ? e.message : e}`);
		}
	}

	private stopGateway(): void {
		this.log("# stop cybria-server");
		this.plugin.api.runner().stopServer((l) => this.log(l));
		void this.refreshStatuses();
		this.callbacks.onGatewayChange();
		void this.callbacks.refreshSwitcher();
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

	private async downloadModel(service: CybriaServiceKey): Promise<void> {
		const modelId = this.selectedModelId(service);
		try {
			await this.plugin.api.downloadModel(service, modelId, (l) => this.log(l));
			new Notice(`${SERVICE_LABELS[service]} model download complete`);
		} catch (e) {
			new Notice(`Download failed: ${e instanceof Error ? e.message : e}`);
		}
	}
}
