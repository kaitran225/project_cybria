import { ALL_MODEL_SLOTS, MODEL_CATALOG, type CatalogModel, type ModelSlot } from "./catalog";

export type HardwareProfileId = "kai-note" | "kyroth-workstation";

export interface HardwareProfile {
	id: HardwareProfileId;
	name: string;
	description: string;
	gpuName: string;
	gpuVramGb: number;
	systemRamGb: number;
	/** Hide models marked tight (borderline VRAM / RAM). */
	hideTight: boolean;
	/** Hide models marked marginal (likely OOM or very slow). */
	hideMarginal: boolean;
	defaultActiveModels: Record<ModelSlot, string>;
}

export const HARDWARE_PROFILES: Record<HardwareProfileId, HardwareProfile> = {
	"kai-note": {
		id: "kai-note",
		name: "Kai Note",
		description: "Laptop — Intel UHD, RTX 3050 4GB, 16GB RAM",
		gpuName: "RTX 3050 4GB",
		gpuVramGb: 4,
		systemRamGb: 16,
		hideTight: true,
		hideMarginal: true,
		defaultActiveModels: {
			llm: "qwen2.5-3b-instruct",
			novel: "ministral-3-3b-novel",
			summarize: "bart-large-cnn",
			tts: "moss-tts-nano",
			image: "dreamshaper-8",
		},
	},
	"kyroth-workstation": {
		id: "kyroth-workstation",
		name: "Kyroth Workstation",
		description: "Desktop — RTX 4060 8GB, 24GB RAM",
		gpuName: "RTX 4060 8GB",
		gpuVramGb: 8,
		systemRamGb: 24,
		hideTight: false,
		hideMarginal: true,
		defaultActiveModels: {
			llm: "gemma-4-12b-agentic-gguf",
			novel: "wanabi-novelist-12b",
			summarize: "bart-large-cnn",
			tts: "moss-tts-nano",
			image: "qwen-lightning",
		},
	},
};

export const DEFAULT_HARDWARE_PROFILE: HardwareProfileId = "kai-note";

export function getHardwareProfile(id: string | undefined): HardwareProfile {
	const key = id as HardwareProfileId;
	return HARDWARE_PROFILES[key] ?? HARDWARE_PROFILES[DEFAULT_HARDWARE_PROFILE];
}

export function listHardwareProfiles(): HardwareProfile[] {
	return Object.values(HARDWARE_PROFILES);
}

/** Whether a catalog entry is safe to show for this hardware profile. */
export function isModelVisibleForProfile(model: CatalogModel, profile: HardwareProfile): boolean {
	if (profile.hideTight && model.runnable === "tight") return false;
	if (profile.hideMarginal && model.runnable === "marginal") return false;

	const minVram = model.minVramGb ?? (model.vram === "heavy" ? 6 : 2);
	if (minVram > profile.gpuVramGb) return false;

	const minRam = model.minRamGb ?? estimateMinRamGb(model);
	if (minRam > profile.systemRamGb) return false;

	return true;
}

function estimateMinRamGb(model: CatalogModel): number {
	if (model.minRamGb != null) return model.minRamGb;
	if (model.sizeGb != null) return Math.ceil(model.sizeGb + 6);
	if (model.vram === "heavy") return 20;
	return 8;
}

export function catalogForProfile(
	slot: ModelSlot,
	profileId: string | undefined
): CatalogModel[] {
	const profile = getHardwareProfile(profileId);
	return MODEL_CATALOG.filter((m) => m.slot === slot && isModelVisibleForProfile(m, profile));
}

export function firstVisibleModelForSlot(
	slot: ModelSlot,
	profileId: string | undefined
): CatalogModel | undefined {
	return catalogForProfile(slot, profileId)[0];
}

export function remapActiveModelsForProfile(
	active: Record<ModelSlot, string>,
	profileId: string | undefined
): Record<ModelSlot, string> {
	const profile = getHardwareProfile(profileId);
	const out = { ...active };

	for (const slot of ALL_MODEL_SLOTS) {
		const id = out[slot];
		const model = MODEL_CATALOG.find((m) => m.id === id);
		if (model && isModelVisibleForProfile(model, profile)) continue;
		const fallback =
			firstVisibleModelForSlot(slot, profileId)?.id ?? profile.defaultActiveModels[slot];
		out[slot] = fallback;
	}
	return out;
}

export const DEFAULT_ACTIVE_MODELS: Record<ModelSlot, string> =
	HARDWARE_PROFILES[DEFAULT_HARDWARE_PROFILE].defaultActiveModels;
