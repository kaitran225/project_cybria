import type { ModelSlot } from "./catalog";
import { DEFAULT_ACTIVE_MODELS } from "./catalog";
import { CYBRIA_BASE_URL } from "./servers";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "./apps/audio/settings";
import type { ImageGenSettings } from "./apps/image/settings";
import { DEFAULT_SETTINGS as DEFAULT_IMAGE_SETTINGS } from "./apps/image/settings";
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from "./apps/llm/settings";
import { DEFAULT_NOVEL_SETTINGS, type NovelSettings } from "./apps/novel/settings";
import type { AppId } from "./apps/types";
import type { OutputRecord } from "./apps/image/types";

export type CoreViewTab = "dashboard" | "apps" | "models" | "servers";

export interface CybriaCoreSettings {
	activeModels: Record<ModelSlot, string>;
	baseUrl: string;
	toolsPath: string;
	terminalHeight: number;
	activeViewTab: CoreViewTab;
	activeAppTab: AppId;
	openDashboardOnStartup: boolean;
	migratedFromSatellites: boolean;
	llm: LlmSettings;
	novel: NovelSettings;
	audio: AudioSettings;
	image: ImageGenSettings;
	imageRecentOutputs: OutputRecord[];
}

export const DEFAULT_SETTINGS: CybriaCoreSettings = {
	activeModels: { ...DEFAULT_ACTIVE_MODELS },
	baseUrl: CYBRIA_BASE_URL,
	toolsPath: "",
	terminalHeight: 200,
	activeViewTab: "dashboard",
	activeAppTab: "llm",
	openDashboardOnStartup: false,
	migratedFromSatellites: false,
	llm: { ...DEFAULT_LLM_SETTINGS },
	novel: { ...DEFAULT_NOVEL_SETTINGS },
	audio: { ...DEFAULT_AUDIO_SETTINGS },
	image: { ...DEFAULT_IMAGE_SETTINGS },
	imageRecentOutputs: [],
};
