export interface ImageGenSettings {
	serverUrl: string;
	qwenToolsPath: string;
	outputFolder: string;
	width: number;
	height: number;
	steps: number;
	cfg: number;
	negativePrompt: string;
	seed: string;
	terminalHeight: number;
	activeTab: "server" | "generate";
}

export const DEFAULT_SETTINGS: ImageGenSettings = {
	serverUrl: "http://127.0.0.1:8789",
	qwenToolsPath: "",
	outputFolder: "Generated/Images",
	width: 768,
	height: 768,
	steps: 20,
	cfg: 4.0,
	negativePrompt: "blurry, low quality",
	seed: "",
	terminalHeight: 160,
	activeTab: "generate",
};

export const DEFAULT_MODEL_LABEL =
	"unsloth/Qwen-Image-2512-unsloth-bnb-4bit";
