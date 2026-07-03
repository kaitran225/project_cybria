export interface NovelSettings {
	summariesFolder: string;
	writePrompt: string;
	activeTab: "write" | "summarize";
}

export const DEFAULT_NOVEL_SETTINGS: NovelSettings = {
	summariesFolder: "Summaries",
	writePrompt:
		"Continue this scene in vivid prose. Match tone and POV. Do not summarize — write the next paragraphs.",
	activeTab: "write",
};
