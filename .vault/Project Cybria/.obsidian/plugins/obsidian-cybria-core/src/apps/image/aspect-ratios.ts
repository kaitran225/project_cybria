export type AspectId = "1:1" | "5:7" | "7:5" | "9:16" | "16:9" | "custom";

export interface AspectPreset {
	id: Exclude<AspectId, "custom">;
	label: string;
	wRatio: number;
	hRatio: number;
}

export const ASPECT_PRESETS: AspectPreset[] = [
	{ id: "1:1", label: "1:1", wRatio: 1, hRatio: 1 },
	{ id: "5:7", label: "5:7", wRatio: 5, hRatio: 7 },
	{ id: "7:5", label: "7:5", wRatio: 7, hRatio: 5 },
	{ id: "9:16", label: "9:16", wRatio: 9, hRatio: 16 },
	{ id: "16:9", label: "16:9", wRatio: 16, hRatio: 9 },
];

function round64(n: number): number {
	return Math.max(256, Math.round(n / 64) * 64);
}

export function sizesForAspect(
	id: Exclude<AspectId, "custom">,
	longEdge: number
): { width: number; height: number } {
	const preset = ASPECT_PRESETS.find((p) => p.id === id) ?? ASPECT_PRESETS[0];
	const scale = longEdge / Math.max(preset.wRatio, preset.hRatio);
	return {
		width: round64(preset.wRatio * scale),
		height: round64(preset.hRatio * scale),
	};
}

export function detectAspect(width: number, height: number): AspectId {
	for (const p of ASPECT_PRESETS) {
		const { width: w, height: h } = sizesForAspect(p.id, Math.max(width, height));
		if (w === width && h === height) return p.id;
	}
	return "custom";
}

export function formatSize(width: number, height: number): string {
	return `${width}×${height}`;
}
