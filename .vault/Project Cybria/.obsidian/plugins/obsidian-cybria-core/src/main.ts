import { Plugin } from "obsidian";
import { generateAndInsert } from "./apps/image/save-generated";
import type { GenerateProgress } from "./apps/image/generate-options";
import type { OutputRecord } from "./apps/image/types";
import type { AppId } from "./apps/types";
import { CybriaCoreApi } from "./api";
import { registerCybriaCommands } from "./commands";
import { migrateSatelliteSettings } from "./migrate-settings";
import { ModelSwitcherView, VIEW_TYPE_MODEL_SWITCHER } from "./ModelSwitcherView";
import { remapActiveModelsForProfile } from "./hardware-profiles";
import type { HardwareProfileId } from "./hardware-profiles";
import { readModelPathsFile, resolveModelPaths, syncModelPathsFile } from "./model-paths";
import { repoRootFromApp } from "./vault";
import { CybriaCoreSettingTab } from "./settings-tab";
import { DEFAULT_SETTINGS, type CoreViewTab, type CybriaCoreSettings } from "./settings";

export default class CybriaCorePlugin extends Plugin {
	settings: CybriaCoreSettings = { ...DEFAULT_SETTINGS };
	api!: CybriaCoreApi;
	lastAudioBuffer: ArrayBuffer | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.api = new CybriaCoreApi(
			this.app,
			() => this.settings,
			() => ({ ...this.settings.activeModels }),
			async (slot, modelId) => {
				this.settings.activeModels[slot] = modelId;
				await this.saveSettings();
			}
		);

		this.registerView(VIEW_TYPE_MODEL_SWITCHER, (leaf) => new ModelSwitcherView(leaf, this));

		this.addRibbonIcon("layout-dashboard", "Cybria AI", () =>
			void this.activateSwitcher(this.settings.activeViewTab === "apps" ? "apps" : "dashboard")
		);

		registerCybriaCommands(this);
		this.addSettingTab(new CybriaCoreSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openDashboardOnStartup) {
				void this.activateSwitcher("dashboard");
			}
		});
	}

	getSwitcherView(): ModelSwitcherView | null {
		const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_MODEL_SWITCHER)[0]?.view;
		return view instanceof ModelSwitcherView ? view : null;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<CybriaCoreSettings> & {
			serverUrls?: Record<string, string>;
		} | null;
		const legacyBase =
			data?.serverUrls?.gateway?.trim() ||
			data?.serverUrls?.llm?.replace(/\/llm\/?$/, "") ||
			"";
		const partial: Partial<CybriaCoreSettings> = {
			...(data ?? {}),
			baseUrl: data?.baseUrl?.trim() || legacyBase || DEFAULT_SETTINGS.baseUrl,
		};
		this.settings = await migrateSatelliteSettings(this.app, partial);

		if (!this.settings.modelPaths.root.trim()) {
			const imported = readModelPathsFile(repoRootFromApp(this.app));
			if (imported) {
				this.settings.modelPaths = imported;
			}
		}
	}

	async saveSettings(): Promise<void> {
		const paths = resolveModelPaths(this.settings.modelPaths);
		syncModelPathsFile(repoRootFromApp(this.app), paths);
		await this.saveData(this.settings);
		this.refreshImagePane();
		this.getSwitcherView()?.refreshModelSelectsForProfile();
	}

	applyHardwareProfile(profileId: HardwareProfileId): void {
		this.settings.hardwareProfile = profileId;
		this.settings.activeModels = remapActiveModelsForProfile(
			this.settings.activeModels,
			profileId
		);
	}

	async activateSwitcher(tab: CoreViewTab = "dashboard", appId?: AppId): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MODEL_SWITCHER)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_MODEL_SWITCHER, active: true });
			leaf = right;
		}
		await workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof ModelSwitcherView) view.showTab(tab, appId);
	}

	addOutputRecord(record: OutputRecord): void {
		this.settings.imageRecentOutputs = [
			record,
			...this.settings.imageRecentOutputs.filter((r) => r.path !== record.path),
		].slice(0, 24);
		void this.saveSettings();
	}

	refreshImagePane(): void {
		const pane = this.getSwitcherView()?.getAppsHost()?.getImagePane();
		pane?.renderGenParams();
		pane?.renderLoraPicker();
		pane?.renderOutput();
	}

	async generateAndInsert(
		prompt: string,
		opts: GenerateProgress | HTMLElement = {},
		legacyRefreshSidebar = false
	): Promise<string> {
		return generateAndInsert(this, prompt, opts, legacyRefreshSidebar);
	}
}
