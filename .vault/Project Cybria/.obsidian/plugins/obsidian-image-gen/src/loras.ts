export interface LoraInfo {
	id: string;
	name: string;
	filename: string;
	path: string;
	compatible: boolean;
	kind: string;
	reason?: string | null;
}

export interface LoraCatalog {
	directory: string;
	exists: boolean;
	model_family?: string;
	loras: LoraInfo[];
	compatible_count: number;
}

export const LORA_NONE = "";

export function loraKindLabel(kind: string): string {
	switch (kind) {
		case "qwen_lora":
			return "Qwen";
		case "sdxl_lora":
			return "SDXL";
		case "sd15_lora":
			return "SD 1.5";
		case "checkpoint":
			return "Checkpoint";
		default:
			return kind;
	}
}
