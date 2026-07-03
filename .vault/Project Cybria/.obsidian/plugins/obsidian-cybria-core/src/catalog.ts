import type { CybriaServiceKey } from "./servers";

/** Logical slot in the switcher UI (novel shares the llm server). */
export type ModelSlot = "llm" | "novel" | "summarize" | "tts" | "image";

export type VramClass = "heavy" | "light";

export interface CatalogModel {
	id: string;
	name: string;
	slot: ModelSlot;
	server: CybriaServiceKey;
	vram: VramClass;
	runnable: "yes" | "tight" | "marginal";
	minVramGb?: number;
	minRamGb?: number;
	sizeGb?: number;
	note?: string;
}

export const MODEL_CATALOG: CatalogModel[] = [
	{
		id: "gemma-4-12b-agentic-gguf",
		name: "Gemma 4 12B Agentic",
		slot: "llm",
		server: "llm",
		vram: "heavy",
		runnable: "yes",
		minVramGb: 6,
		minRamGb: 16,
		sizeGb: 7.5,
		note: "Chat / agentic coding — needs 6GB+ VRAM",
	},
	{
		id: "ornith-1.0-9b",
		name: "Ornith 1.0 9B",
		slot: "llm",
		server: "llm",
		vram: "heavy",
		runnable: "yes",
		minVramGb: 6,
		minRamGb: 16,
		sizeGb: 7,
		note: "Chat / agentic coding — needs 6GB+ VRAM",
	},
	{
		id: "qwen2.5-3b-instruct",
		name: "Qwen2.5 3B (light)",
		slot: "llm",
		server: "llm",
		vram: "light",
		runnable: "yes",
		minVramGb: 2,
		minRamGb: 8,
		sizeGb: 2,
		note: "4GB-VRAM chat",
	},
	{
		id: "wanabi-novelist-12b",
		name: "Wanabi Novelist 12B",
		slot: "novel",
		server: "llm",
		vram: "heavy",
		runnable: "yes",
		minVramGb: 6,
		minRamGb: 16,
		sizeGb: 7.6,
		note: "Novel writing — needs 6GB+ VRAM",
	},
	{
		id: "ministral-3-3b-novel",
		name: "Ministral 3 3B (light)",
		slot: "novel",
		server: "llm",
		vram: "light",
		runnable: "yes",
		minVramGb: 2,
		minRamGb: 8,
		sizeGb: 2.15,
		note: "Mistral 3B instruct — 4GB-VRAM novel",
	},
	{
		id: "nqlsg-qwen3-14b-novel",
		name: "NQLSG Qwen3 14B Novel",
		slot: "novel",
		server: "llm",
		vram: "heavy",
		runnable: "tight",
		minVramGb: 8,
		minRamGb: 20,
		sizeGb: 9.1,
		note: "Novel writing — tight on 8GB",
	},
	{
		id: "bart-large-cnn",
		name: "BART Large CNN",
		slot: "summarize",
		server: "summarize",
		vram: "light",
		runnable: "yes",
		minVramGb: 0,
		minRamGb: 6,
		sizeGb: 1.6,
	},
	{
		id: "pegasus-xsum",
		name: "PEGASUS XSum",
		slot: "summarize",
		server: "summarize",
		vram: "light",
		runnable: "yes",
		minVramGb: 0,
		minRamGb: 6,
		sizeGb: 2.3,
	},
	{
		id: "moss-tts-nano",
		name: "MOSS-TTS-Nano",
		slot: "tts",
		server: "tts",
		vram: "light",
		runnable: "yes",
		minVramGb: 2,
		minRamGb: 8,
		sizeGb: 0.4,
		note: "0.1B — 4GB-VRAM / CPU friendly",
	},
	{
		id: "higgs-tts-3-4b",
		name: "Higgs TTS 3 4B",
		slot: "tts",
		server: "tts",
		vram: "heavy",
		runnable: "tight",
		minVramGb: 6,
		minRamGb: 16,
		sizeGb: 5,
		note: "Heavy — needs 6GB+ VRAM",
	},
	{
		id: "dreamshaper-8",
		name: "DreamShaper 8 (SD1.5)",
		slot: "image",
		server: "image",
		vram: "light",
		runnable: "yes",
		minVramGb: 2,
		minRamGb: 8,
		sizeGb: 2,
		note: "Lightweight SD1.5 — fast on 4GB",
	},
	{
		id: "qwen-lightning",
		name: "Qwen Image Lightning",
		slot: "image",
		server: "image",
		vram: "heavy",
		runnable: "tight",
		minVramGb: 8,
		minRamGb: 16,
		note: "Fast image gen — 8GB tuned",
	},
	{
		id: "heartsync-nsfw",
		name: "Heartsync SDXL",
		slot: "image",
		server: "image",
		vram: "heavy",
		runnable: "tight",
		minVramGb: 6,
		minRamGb: 16,
		note: "SDXL — slow on 4GB (6GB+ VRAM)",
	},
	{
		id: "nsfw-gen-v2",
		name: "NSFW-gen v2 (test)",
		slot: "image",
		server: "image",
		vram: "heavy",
		runnable: "tight",
		minVramGb: 6,
		minRamGb: 16,
		sizeGb: 6,
		note: "SDXL — slow on 4GB (6GB+ VRAM)",
	},
];

export const SLOT_LABELS: Record<ModelSlot, string> = {
	llm: "LLM Chat",
	novel: "Novel Writing",
	summarize: "Summarization",
	tts: "Text-to-Speech",
	image: "Image Generation",
};

export function getCatalogModel(id: string): CatalogModel | undefined {
	return MODEL_CATALOG.find((m) => m.id === id);
}

export function serverForSlot(slot: ModelSlot): CybriaServiceKey {
	const m = MODEL_CATALOG.find((x) => x.slot === slot);
	return m?.server ?? (slot === "novel" ? "llm" : slot);
}
