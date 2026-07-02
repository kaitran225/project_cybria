import type { CybriaServiceKey } from "./servers";

export const SERVICE_LABELS: Record<CybriaServiceKey, string> = {
	llm: "LLM",
	summarize: "Summarize",
	tts: "TTS",
	image: "Diffusion",
};

export const SERVICE_ICONS: Record<CybriaServiceKey, string> = {
	llm: "bot",
	summarize: "file-text",
	tts: "audio-lines",
	image: "image",
};

export const SERVICE_BLURBS: Record<CybriaServiceKey, string> = {
	llm: "Chat & text completion",
	summarize: "Vault summarization",
	tts: "Text-to-speech",
	image: "Image generation",
};
