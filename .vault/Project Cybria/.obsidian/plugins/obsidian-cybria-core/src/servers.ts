export const CYBRIA_CORE_ID = "cybria-core";

export const CYBRIA_PORT = 2253;
export const CYBRIA_BASE_URL = `http://127.0.0.1:${CYBRIA_PORT}`;
export const GATEWAY_TOOLS = "cybria-server";

export type CybriaServiceKey = "llm" | "summarize" | "tts" | "image";
export type CybriaServerKey = CybriaServiceKey | "gateway";

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
	image: "qwen-image",
};

/** @deprecated Use CYBRIA_BASE_URL + SERVICE_PATHS */
export const CYBRIA_SERVERS = {
	gateway: {
		id: "gateway",
		toolsSubdir: GATEWAY_TOOLS,
		defaultUrl: CYBRIA_BASE_URL,
		port: CYBRIA_PORT,
	},
	llm: { id: "llm", toolsSubdir: SERVICE_TOOLS.llm, defaultUrl: `${CYBRIA_BASE_URL}/llm`, port: CYBRIA_PORT },
	summarize: {
		id: "summarize",
		toolsSubdir: SERVICE_TOOLS.summarize,
		defaultUrl: `${CYBRIA_BASE_URL}/summarize`,
		port: CYBRIA_PORT,
	},
	tts: { id: "tts", toolsSubdir: SERVICE_TOOLS.tts, defaultUrl: `${CYBRIA_BASE_URL}/tts`, port: CYBRIA_PORT },
	image: {
		id: "image",
		toolsSubdir: SERVICE_TOOLS.image,
		defaultUrl: `${CYBRIA_BASE_URL}/image`,
		port: CYBRIA_PORT,
	},
} as const;
