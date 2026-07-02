import type { CybriaServiceKey } from "./servers";

export const SERVICE_LABELS: Record<CybriaServiceKey, string> = {
	llm: "LLM",
	summarize: "Summarize",
	tts: "TTS",
	image: "Diffusion",
};
