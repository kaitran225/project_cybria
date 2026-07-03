import type { Layer, SparsePixel } from "@pixode/asset-core";

const EMPTY = -1;

export class LayerGrid {
  readonly width: number;
  readonly height: number;
  private data: Int16Array;

  constructor(width: number, height: number, layer?: Layer) {
    this.width = width;
    this.height = height;
    this.data = new Int16Array(width * height).fill(EMPTY);
    if (layer) this.fromLayer(layer);
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return EMPTY;
    return this.data[this.idx(x, y)];
  }

  set(x: number, y: number, colorId: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[this.idx(x, y)] = colorId;
  }

  clear(x: number, y: number): void {
    this.set(x, y, EMPTY);
  }

  paintSquare(x: number, y: number, size: number, colorId: number): void {
    const half = Math.floor((size - 1) / 2);
    for (let dy = -half; dy <= size - 1 - half; dy++) {
      for (let dx = -half; dx <= size - 1 - half; dx++) {
        this.set(x + dx, y + dy, colorId);
      }
    }
  }

  clearSquare(x: number, y: number, size: number): void {
    const half = Math.floor((size - 1) / 2);
    for (let dy = -half; dy <= size - 1 - half; dy++) {
      for (let dx = -half; dx <= size - 1 - half; dx++) {
        this.clear(x + dx, y + dy);
      }
    }
  }

  fromLayer(layer: Layer): void {
    this.data.fill(EMPTY);
    for (const px of layer.pixels) {
      this.set(px.x, px.y, px.c);
    }
  }

  toSparsePixels(): SparsePixel[] {
    const pixels: SparsePixel[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        if (c !== EMPTY) pixels.push({ x, y, c });
      }
    }
    return pixels;
  }

  floodFill(startX: number, startY: number, newColor: number): void {
    const target = this.get(startX, startY);
    if (target === newColor) return;
    const stack: Array<[number, number]> = [[startX, startY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
      if (this.get(x, y) !== target) continue;
      visited.add(key);
      this.set(x, y, newColor);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  fillRect(x0: number, y0: number, x1: number, y1: number, colorId: number): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.set(x, y, colorId);
      }
    }
  }

  clone(): LayerGrid {
    const copy = new LayerGrid(this.width, this.height);
    copy.restoreData(this.data.slice());
    return copy;
  }

  cloneData(): Int16Array {
    return this.data.slice();
  }

  restoreData(data: Int16Array): void {
    this.data = data.slice();
  }

  equals(other: LayerGrid): boolean {
    if (this.width !== other.width || this.height !== other.height) return false;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }

  extractRegion(x0: number, y0: number, x1: number, y1: number): Int16Array {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const region = new Int16Array(w * h).fill(EMPTY);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        region[(y - minY) * w + (x - minX)] = this.get(x, y);
      }
    }
    return region;
  }

  pasteRegion(
    x0: number,
    y0: number,
    w: number,
    h: number,
    data: Int16Array,
    clearSource = false
  ): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = data[y * w + x];
        if (c !== EMPTY) this.set(x0 + x, y0 + y, c);
        else if (clearSource) this.clear(x0 + x, y0 + y);
      }
    }
  }

  clearRegion(x0: number, y0: number, x1: number, y1: number): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.clear(x, y);
      }
    }
  }

  flipRegionH(x0: number, y0: number, x1: number, y1: number): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const buf = this.extractRegion(minX, minY, maxX, maxY);
    const flipped = new Int16Array(buf.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        flipped[y * w + (w - 1 - x)] = buf[y * w + x];
      }
    }
    this.clearRegion(minX, minY, maxX, maxY);
    this.pasteRegion(minX, minY, w, h, flipped);
  }

  flipRegionV(x0: number, y0: number, x1: number, y1: number): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const buf = this.extractRegion(minX, minY, maxX, maxY);
    const flipped = new Int16Array(buf.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        flipped[(h - 1 - y) * w + x] = buf[y * w + x];
      }
    }
    this.clearRegion(minX, minY, maxX, maxY);
    this.pasteRegion(minX, minY, w, h, flipped);
  }
}
