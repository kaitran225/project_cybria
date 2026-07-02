export interface ImageGenSettings {
	serverUrl: string;
	qwenToolsPath: string;
	outputFolder: string;
	modelId: string;
	aspectRatio: string;
	width: number;
	height: number;
	steps: number;
	cfg: number;
	negativePrompt: string;
	seed: string;
	lora: string;
	loraScale: number;
	generateTimeoutMinutes: number;
	terminalHeight: number;
	activeTab: "server" | "generate";
}

export const DEFAULT_SETTINGS: ImageGenSettings = {
	serverUrl: "http://127.0.0.1:8789",
	qwenToolsPath: "",
	outputFolder: "Generated/Images",
	modelId: "qwen-lightning",
	aspectRatio: "1:1",
	width: 512,
	height: 512,
	steps: 8,
	cfg: 1.0,
	negativePrompt: "blurry, low quality",
	seed: "",
	lora: "",
	loraScale: 0.85,
	generateTimeoutMinutes: 0,
	terminalHeight: 160,
	activeTab: "generate",
};

export const DEFAULT_MODEL_LABEL =
	"unsloth/Qwen-Image-2512-unsloth-bnb-4bit";
