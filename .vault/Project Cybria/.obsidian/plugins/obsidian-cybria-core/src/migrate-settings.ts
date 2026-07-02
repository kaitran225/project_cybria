import { App } from "obsidian";
import type { CybriaCoreSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./settings";

async function readPluginData(app: App, pluginId: string): Promise<Record<string, unknown> | null> {
	const base = app.vault.configDir;
	const path = `${base}/plugins/${pluginId}/data.json`;
	try {
		if (!(await app.vault.adapter.exists(path))) return null;
		const raw = await app.vault.adapter.read(path);
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export async function migrateSatelliteSettings(
	app: App,
	current: Partial<CybriaCoreSettings>
): Promise<CybriaCoreSettings> {
	const merged: CybriaCoreSettings = {
		...DEFAULT_SETTINGS,
		...current,
		activeModels: { ...DEFAULT_SETTINGS.activeModels, ...(current.activeModels ?? {}) },
		llm: { ...DEFAULT_SETTINGS.llm, ...(current.llm ?? {}) },
		novel: { ...DEFAULT_SETTINGS.novel, ...(current.novel ?? {}) },
		audio: { ...DEFAULT_SETTINGS.audio, ...(current.audio ?? {}) },
		image: { ...DEFAULT_SETTINGS.image, ...(current.image ?? {}) },
		imageRecentOutputs: current.imageRecentOutputs ?? DEFAULT_SETTINGS.imageRecentOutputs,
	};

	if (current.migratedFromSatellites) return merged;

	const llmData = await readPluginData(app, "cybria-llm");
	if (llmData) Object.assign(merged.llm, llmData);

	const novelData = await readPluginData(app, "cybria-novel");
	if (novelData) {
		Object.assign(merged.novel, {
			summarizeMode: novelData.summarizeMode,
			summariesFolder: novelData.summariesFolder,
			writePrompt: novelData.writePrompt,
			activeTab: novelData.activeTab,
		});
	}

	const audioData = await readPluginData(app, "cybria-audio");
	if (audioData?.outputFolder) merged.audio.outputFolder = String(audioData.outputFolder);

	const imageData = await readPluginData(app, "image-gen");
	if (imageData) {
		const { recentOutputs, migratedFast512, ...rest } = imageData as Record<string, unknown>;
		Object.assign(merged.image, rest);
		if (Array.isArray(recentOutputs)) {
			merged.imageRecentOutputs = recentOutputs as CybriaCoreSettings["imageRecentOutputs"];
		}
	}

	merged.migratedFromSatellites = true;
	return merged;
}
