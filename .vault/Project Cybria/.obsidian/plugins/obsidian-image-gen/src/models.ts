export interface ModelInfo {
	id: string;
	name: string;
	repo_id: string;
	family: string;
	lightning: boolean;
	default_steps: number;
	default_cfg: number;
	default_size: number;
	max_side: number;
	source: string;
	note?: string | null;
}

export interface ModelCatalog {
	models: ModelInfo[];
	default: string;
	loaded?: string | null;
}

/** Mirrors server [models.py](.tools/qwen-image/models.py) — used when server is offline. */
export const BUILTIN_MODELS: ModelInfo[] = [
	{
		id: "qwen-lightning",
		name: "Qwen Image (Lightning)",
		repo_id: "unsloth/Qwen-Image-2512-unsloth-bnb-4bit",
		family: "qwen",
		lightning: true,
		default_steps: 8,
		default_cfg: 1.0,
		default_size: 512,
		max_side: 512,
		source: "builtin",
		note: "Fast — best for 8GB VRAM",
	},
	{
		id: "heartsync-nsfw",
		name: "Heartsync NSFW Uncensored",
		repo_id: "Heartsync/NSFW-Uncensored",
		family: "sdxl",
		lightning: false,
		default_steps: 25,
		default_cfg: 7.5,
		default_size: 768,
		max_side: 768,
		source: "huggingface",
		note: "SDXL — first load downloads from Hugging Face (~6 GB)",
	},
];

export function modelsForPicker(catalog: ModelInfo[]): ModelInfo[] {
	return catalog.length > 0 ? catalog : BUILTIN_MODELS;
}

export function modelSupportsLora(family: string): boolean {
	return family === "qwen" || family === "sdxl";
}

export function modelFamilyLabel(family: string): string {
	switch (family) {
		case "qwen":
			return "Qwen";
		case "sdxl":
			return "SDXL";
		default:
			return family.toUpperCase();
	}
}
