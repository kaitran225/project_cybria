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
