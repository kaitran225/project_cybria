export interface ImageGenSettings {
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
}

export const DEFAULT_SETTINGS: ImageGenSettings = {
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
};

export const DEFAULT_MODEL_LABEL =
	"unsloth/Qwen-Image-2512-unsloth-bnb-4bit";
