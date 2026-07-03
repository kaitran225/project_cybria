export const CYBRIA_CORE_ID = "cybria-core";

export const CYBRIA_PORT = 2253;
export const CYBRIA_BASE_URL = `http://127.0.0.1:${CYBRIA_PORT}`;
export const GATEWAY_TOOLS = "cybria-server";

export type CybriaServiceKey = "llm" | "summarize" | "tts" | "image";
export type CybriaServerKey = CybriaServiceKey | "gateway";

/** Primary model slot controlled from each service card on the Servers tab. */
export type ServiceModelSlot = "llm" | "summarize" | "tts" | "image";

export const SERVICE_SLOT: Record<CybriaServiceKey, ServiceModelSlot> = {
	llm: "llm",
	summarize: "summarize",
	tts: "tts",
	image: "image",
};

export const SERVICE_PATHS: Record<CybriaServiceKey, string> = {
	llm: "/llm",
	summarize: "/summarize",
	tts: "/tts",
	image: "/image",
};

export const SERVICE_TOOLS: Record<CybriaServiceKey, string> = {
	llm: "cybria-llm",
	summarize: "cybria-summarize",
	tts: "cybria-tts",
	image: "cybria-diffuser",
};

export const ALL_SERVICES: CybriaServiceKey[] = ["llm", "summarize", "tts", "image"];
