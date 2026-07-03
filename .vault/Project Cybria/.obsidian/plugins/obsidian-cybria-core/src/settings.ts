import type { ModelSlot } from "./catalog";
import { DEFAULT_ACTIVE_MODELS } from "./hardware-profiles";
import { CYBRIA_BASE_URL } from "./servers";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "./apps/audio/settings";
import type { ImageGenSettings } from "./apps/image/settings";
import { DEFAULT_SETTINGS as DEFAULT_IMAGE_SETTINGS } from "./apps/image/settings";
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from "./apps/llm/settings";
import { DEFAULT_NOVEL_SETTINGS, type NovelSettings } from "./apps/novel/settings";
import type { AppId } from "./apps/types";
import type { OutputRecord } from "./apps/image/types";
import type { HardwareProfileId } from "./hardware-profiles";
import { DEFAULT_HARDWARE_PROFILE } from "./hardware-profiles";

export type CoreViewTab = "dashboard" | "apps" | "servers";

export interface ModelPathsConfig {
	root: string;
	loras: string;
	huggingface: string;
	llm: string;
	tts: string;
	summarization: string;
}

export const EMPTY_MODEL_PATHS: ModelPathsConfig = {
	root: "",
	loras: "",
	huggingface: "",
	llm: "",
	tts: "",
	summarization: "",
};

export interface CybriaCoreSettings {
	activeModels: Record<ModelSlot, string>;
	hardwareProfile: HardwareProfileId;
	baseUrl: string;
	toolsPath: string;
	modelPaths: ModelPathsConfig;
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
	hardwareProfile: DEFAULT_HARDWARE_PROFILE,
	baseUrl: CYBRIA_BASE_URL,
	toolsPath: "",
	modelPaths: { ...EMPTY_MODEL_PATHS },
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
