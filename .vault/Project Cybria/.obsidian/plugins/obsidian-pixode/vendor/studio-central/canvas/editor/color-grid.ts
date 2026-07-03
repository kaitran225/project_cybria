import { hslToHex } from "./color-utils.js";

/** Build a fine iOS-style color grid: grayscale row + saturated-to-pastel rows. */
export function buildColorGrid(cols = 20, colorRows = 14): string[][] {
  const grid: string[][] = [];

  const grayRow: string[] = [];
  for (let c = 0; c < cols; c++) {
    const l = 100 - (c / Math.max(1, cols - 1)) * 100;
    grayRow.push(hslToHex(0, 0, l));
  }
  grid.push(grayRow);

  for (let r = 0; r < colorRows; r++) {
    const row: string[] = [];
    const t = r / Math.max(1, colorRows - 1);
    const s = Math.round(98 - t * 58);
    const l = Math.round(26 + t * 44);
    for (let c = 0; c < cols; c++) {
      const h = (c / cols) * 360;
      row.push(hslToHex(h, s, l));
    }
    grid.push(row);
  }

  return grid;
}
