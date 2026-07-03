import { App } from "obsidian";
import type { CybriaCoreSettings } from "./settings";
import { DEFAULT_SETTINGS, EMPTY_MODEL_PATHS } from "./settings";
import { remapActiveModelsForProfile } from "./hardware-profiles";

const DEPRECATED_MODEL_IDS: Record<string, string> = {
	"qwen2.5-3b-novel": "ministral-3-3b-novel",
};

function remapActiveModels(
	active: CybriaCoreSettings["activeModels"],
	profileId: CybriaCoreSettings["hardwareProfile"]
): CybriaCoreSettings["activeModels"] {
	const out = { ...active };
	for (const slot of Object.keys(out) as (keyof typeof out)[]) {
		const id = out[slot];
		const replacement = DEPRECATED_MODEL_IDS[id];
		if (replacement) out[slot] = replacement;
	}
	return remapActiveModelsForProfile(out, profileId);
}

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
		hardwareProfile: current.hardwareProfile ?? DEFAULT_SETTINGS.hardwareProfile,
		activeModels: remapActiveModels(
			{ ...DEFAULT_SETTINGS.activeModels, ...(current.activeModels ?? {}) },
			current.hardwareProfile ?? DEFAULT_SETTINGS.hardwareProfile
		),
		llm: { ...DEFAULT_SETTINGS.llm, ...(current.llm ?? {}) },
		novel: { ...DEFAULT_SETTINGS.novel, ...(current.novel ?? {}) },
		audio: { ...DEFAULT_SETTINGS.audio, ...(current.audio ?? {}) },
		image: { ...DEFAULT_SETTINGS.image, ...(current.image ?? {}) },
		imageRecentOutputs: current.imageRecentOutputs ?? DEFAULT_SETTINGS.imageRecentOutputs,
		modelPaths: {
			...EMPTY_MODEL_PATHS,
			...(current.modelPaths ?? {}),
		},
	};

	if ((merged.activeViewTab as string) === "models") {
		merged.activeViewTab = "servers";
	}

	if (current.migratedFromSatellites) return merged;

	const llmData = await readPluginData(app, "cybria-llm");
	if (llmData) Object.assign(merged.llm, llmData);

	const novelData = await readPluginData(app, "cybria-novel");
	if (novelData) {
		Object.assign(merged.novel, {
			summariesFolder: novelData.summariesFolder,
			writePrompt: novelData.writePrompt,
			activeTab: novelData.activeTab,
		});
	}

	const audioData = await readPluginData(app, "cybria-audio");
	if (audioData?.outputFolder) merged.audio.outputFolder = String(audioData.outputFolder);

	const imageData =
		(await readPluginData(app, "image-gen")) ??
		(await readPluginData(app, "obsidian-image-gen"));
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
