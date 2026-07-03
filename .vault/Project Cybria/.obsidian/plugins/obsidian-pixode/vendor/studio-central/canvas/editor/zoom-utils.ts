export const ZOOM_PRESETS = [
  { label: "25%", scale: 4 },
  { label: "50%", scale: 8 },
  { label: "100%", scale: 16 },
  { label: "200%", scale: 32 },
  { label: "400%", scale: 64 },
  { label: "800%", scale: 128 },
  { label: "1600%", scale: 256 },
] as const;

export function scaleToPercent(scale: number): string {
  const preset = ZOOM_PRESETS.find((p) => p.scale === scale);
  if (preset) return preset.label;
  return `${Math.round((scale / 16) * 100)}%`;
}

export function nextZoomPreset(scale: number, direction: 1 | -1): number {
  const idx = ZOOM_PRESETS.findIndex((p) => p.scale === scale);
  if (idx === -1) {
    const nearest = ZOOM_PRESETS.reduce((best, p) =>
      Math.abs(p.scale - scale) < Math.abs(best.scale - scale) ? p : best
    );
    const ni = ZOOM_PRESETS.indexOf(nearest) + direction;
    return ZOOM_PRESETS[Math.max(0, Math.min(ZOOM_PRESETS.length - 1, ni))].scale;
  }
  const next = idx + direction;
  return ZOOM_PRESETS[Math.max(0, Math.min(ZOOM_PRESETS.length - 1, next))].scale;
}

export function fitZoom(
  canvasW: number,
  canvasH: number,
  viewportW: number,
  viewportH: number
): number {
  if (viewportW <= 0 || viewportH <= 0) return 16;
  const scaleX = Math.floor((viewportW - 48) / canvasW);
  const scaleY = Math.floor((viewportH - 48) / canvasH);
  const scale = Math.max(4, Math.min(scaleX, scaleY, 256));
  return scale;
}
