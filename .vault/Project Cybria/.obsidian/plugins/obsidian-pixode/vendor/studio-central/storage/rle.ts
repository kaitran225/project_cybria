import type { SparsePixel } from "@pixode/asset-core";

const RLE_THRESHOLD = 4096;

export function shouldCompress(width: number, height: number): boolean {
  return width * height > RLE_THRESHOLD;
}

/** Simple row-major RLE: [x,y,c,a?, x,y,c,a?, ...] grouped by runs of identical color per row */
export function compressPixels(
  width: number,
  height: number,
  pixels: SparsePixel[]
): string {
  const grid = new Map<string, SparsePixel>();
  for (const p of pixels) {
    grid.set(`${p.x},${p.y}`, p);
  }
  const runs: string[] = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const p = grid.get(`${x},${y}`);
      const c = p?.c ?? -1;
      const a = p?.a;
      let len = 1;
      while (x + len < width) {
        const np = grid.get(`${x + len},${y}`);
        const nc = np?.c ?? -1;
        const na = np?.a;
        if (nc !== c || na !== a) break;
        len++;
      }
      runs.push(`${x},${y},${c},${a ?? ""},${len}`);
      x += len;
    }
  }
  return runs.join(";");
}

export function decompressPixels(data: string): SparsePixel[] {
  const pixels: SparsePixel[] = [];
  if (!data) return pixels;
  for (const run of data.split(";")) {
    const [xs, ys, cs, as, lens] = run.split(",");
    const x0 = Number(xs);
    const y = Number(ys);
    const c = Number(cs);
    const a = as === "" ? undefined : Number(as);
    const len = Number(lens);
    if (c < 0) continue;
    for (let i = 0; i < len; i++) {
      const px: SparsePixel = { x: x0 + i, y, c };
      if (a !== undefined) px.a = a;
      pixels.push(px);
    }
  }
  return pixels;
}

export function getSnippetPixels(snippet: {
  width: number;
  height: number;
  pixels: SparsePixel[];
  compressed?: boolean;
  compressedData?: string;
}): SparsePixel[] {
  if (snippet.compressed && snippet.compressedData) {
    return decompressPixels(snippet.compressedData);
  }
  return snippet.pixels;
}
