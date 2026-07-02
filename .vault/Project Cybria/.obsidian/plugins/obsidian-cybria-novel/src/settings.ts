export interface NovelSettings {
	llmServerUrl: string;
	summarizeServerUrl: string;
	llmToolsPath: string;
	summarizeToolsPath: string;
	novelModelId: string;
	summarizeModelId: string;
	summariesFolder: string;
	writePrompt: string;
	terminalHeight: number;
	activeTab: "write" | "summarize" | "server";
}

export const DEFAULT_SETTINGS: NovelSettings = {
	llmServerUrl: "http://127.0.0.1:8790",
	summarizeServerUrl: "http://127.0.0.1:8791",
	llmToolsPath: "",
	summarizeToolsPath: "",
	novelModelId: "wanabi-novelist-12b",
	summarizeModelId: "bart-large-cnn",
	summariesFolder: "Summaries",
	writePrompt:
		"Continue this scene in vivid prose. Match tone and POV. Do not summarize — write the next paragraphs.",
	terminalHeight: 160,
	activeTab: "write",
};

export const NOVEL_MODELS = [
	{ id: "wanabi-novelist-12b", name: "Wanabi 12B" },
	{ id: "nqlsg-qwen3-14b-novel", name: "NQLSG Qwen3 14B" },
];

export const SUMMARIZE_MODELS = [
	{ id: "bart-large-cnn", name: "BART CNN" },
	{ id: "pegasus-xsum", name: "PEGASUS XSum" },
];
