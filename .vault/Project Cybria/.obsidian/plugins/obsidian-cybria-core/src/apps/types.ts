import type { ModelSlot } from "../catalog";

export type AppId = "llm" | "novel" | "audio" | "image";

export interface AppPane {
	mount(root: HTMLElement): void;
	unmount(): void;
	onShow(): void;
}

export interface AppDef {
	id: AppId;
	title: string;
	icon: string;
	slot: ModelSlot;
}

export const APP_DEFS: AppDef[] = [
	{ id: "llm", title: "Chat", icon: "bot", slot: "llm" },
	{ id: "novel", title: "Novel", icon: "book-open", slot: "novel" },
	{ id: "audio", title: "Audio", icon: "audio-lines", slot: "tts" },
	{ id: "image", title: "Image Gen", icon: "image", slot: "image" },
];

export function appTitle(id: AppId): string {
	return APP_DEFS.find((a) => a.id === id)?.title ?? id;
}
