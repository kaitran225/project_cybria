export const CYBRIA_CORE_ID = "cybria-core";

export const CYBRIA_SERVERS = {
	llm: {
		id: "llm",
		toolsSubdir: "cybria-llm",
		defaultUrl: "http://127.0.0.1:8790",
		port: 8790,
	},
	summarize: {
		id: "summarize",
		toolsSubdir: "cybria-summarize",
		defaultUrl: "http://127.0.0.1:8791",
		port: 8791,
	},
	tts: {
		id: "tts",
		toolsSubdir: "cybria-tts",
		defaultUrl: "http://127.0.0.1:8792",
		port: 8792,
	},
	image: {
		id: "image",
		toolsSubdir: "qwen-image",
		defaultUrl: "http://127.0.0.1:8789",
		port: 8789,
	},
} as const;

export type CybriaServerKey = keyof typeof CYBRIA_SERVERS;
