import type { CybriaServerKey } from "./servers";

/** Logical slot in the switcher UI (novel shares the llm server). */
export type ModelSlot = "llm" | "novel" | "summarize" | "tts" | "image";

export type VramClass = "heavy" | "light";

export interface CatalogModel {
	id: string;
	name: string;
	slot: ModelSlot;
	server: CybriaServerKey;
	vram: VramClass;
	runnable: "yes" | "tight" | "marginal";
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
		sizeGb: 7.5,
		note: "Chat / agentic coding",
	},
	{
		id: "ornith-1.0-9b",
		name: "Ornith 1.0 9B",
		slot: "llm",
		server: "llm",
		vram: "heavy",
		runnable: "yes",
		sizeGb: 7,
		note: "Chat / agentic coding",
	},
	{
		id: "wanabi-novelist-12b",
		name: "Wanabi Novelist 12B",
		slot: "novel",
		server: "llm",
		vram: "heavy",
		runnable: "yes",
		sizeGb: 7.6,
		note: "Novel writing",
	},
	{
		id: "nqlsg-qwen3-14b-novel",
		name: "NQLSG Qwen3 14B Novel",
		slot: "novel",
		server: "llm",
		vram: "heavy",
		runnable: "tight",
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
		sizeGb: 1.6,
	},
	{
		id: "pegasus-xsum",
		name: "PEGASUS XSum",
		slot: "summarize",
		server: "summarize",
		vram: "light",
		runnable: "yes",
		sizeGb: 2.3,
	},
	{
		id: "higgs-tts-3-4b",
		name: "Higgs TTS 3 4B",
		slot: "tts",
		server: "tts",
		vram: "heavy",
		runnable: "tight",
		sizeGb: 5,
		note: "Text-to-speech",
	},
	{
		id: "qwen-lightning",
		name: "Qwen Image Lightning",
		slot: "image",
		server: "image",
		vram: "heavy",
		runnable: "yes",
		note: "Fast image gen — 8GB tuned",
	},
	{
		id: "heartsync-nsfw",
		name: "Heartsync SDXL",
		slot: "image",
		server: "image",
		vram: "heavy",
		runnable: "yes",
		note: "SDXL image gen",
	},
];

export const DEFAULT_ACTIVE_MODELS: Record<ModelSlot, string> = {
	llm: "gemma-4-12b-agentic-gguf",
	novel: "wanabi-novelist-12b",
	summarize: "bart-large-cnn",
	tts: "higgs-tts-3-4b",
	image: "qwen-lightning",
};

export const SLOT_LABELS: Record<ModelSlot, string> = {
	llm: "LLM Chat",
	novel: "Novel Writing",
	summarize: "Summarization",
	tts: "Text-to-Speech",
	image: "Image Generation",
};

export function catalogForSlot(slot: ModelSlot): CatalogModel[] {
	return MODEL_CATALOG.filter((m) => m.slot === slot);
}

export function getCatalogModel(id: string): CatalogModel | undefined {
	return MODEL_CATALOG.find((m) => m.id === id);
}

export function serverForSlot(slot: ModelSlot): CybriaServerKey {
	const m = MODEL_CATALOG.find((x) => x.slot === slot);
	return m?.server ?? (slot === "novel" ? "llm" : slot);
}
