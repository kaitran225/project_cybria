export interface LlmSettings {
	serverUrl: string;
	toolsPath: string;
	modelId: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	terminalHeight: number;
	activeTab: "chat" | "server";
}

export const DEFAULT_SETTINGS: LlmSettings = {
	serverUrl: "http://127.0.0.1:8790",
	toolsPath: "",
	modelId: "gemma-4-12b-agentic-gguf",
	systemPrompt: "You are a helpful assistant.",
	temperature: 0.7,
	maxTokens: 2048,
	terminalHeight: 160,
	activeTab: "chat",
};

export const CHAT_MODELS = [
	{ id: "gemma-4-12b-agentic-gguf", name: "Gemma 4 12B" },
	{ id: "ornith-1.0-9b", name: "Ornith 9B" },
];
