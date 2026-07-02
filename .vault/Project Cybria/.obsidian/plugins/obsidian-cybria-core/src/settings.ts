import type { ModelSlot } from "./catalog";
import { DEFAULT_ACTIVE_MODELS } from "./catalog";

export interface CybriaCoreSettings {
	activeModels: Record<ModelSlot, string>;
}

export const DEFAULT_SETTINGS: CybriaCoreSettings = {
	activeModels: { ...DEFAULT_ACTIVE_MODELS },
};
