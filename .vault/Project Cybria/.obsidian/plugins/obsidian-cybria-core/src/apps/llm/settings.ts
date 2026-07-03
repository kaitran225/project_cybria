export interface LlmSettings {
	modelId: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
	modelId: "qwen2.5-3b-instruct",
	systemPrompt: "You are a helpful assistant.",
	temperature: 0.7,
	maxTokens: 2048,
};
