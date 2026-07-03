import type { CatalogModel } from "../../catalog";

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

export function imageModelsFromCatalog(entries: CatalogModel[]): ModelInfo[] {
	return entries
		.filter(
			(e): e is CatalogModel & { imageParams: NonNullable<CatalogModel["imageParams"]> } =>
				e.slot === "image" && !!e.imageParams
		)
		.map((e) => ({
			id: e.id,
			name: e.name,
			repo_id: e.imageParams.repo_id ?? e.id,
			family: e.imageParams.family,
			lightning: e.imageParams.lightning,
			default_steps: e.imageParams.default_steps,
			default_cfg: e.imageParams.default_cfg,
			default_size: e.imageParams.default_size,
			max_side: e.imageParams.max_side,
			source: "catalog",
			note: e.note ?? null,
		}));
}

export function modelsForPicker(catalog: ModelInfo[], fallback: ModelInfo[] = []): ModelInfo[] {
	return catalog.length > 0 ? catalog : fallback;
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
