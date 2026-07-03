const LIME_PALETTE = ['#bfff00', '#d4ff4d', '#8fbf00', 'rgba(191,255,0,0.7)', 'rgba(191,255,0,0.45)'];

const rand = (min, max) => Math.random() * (max - min) + min;

export function pickLimeColor() {
  return LIME_PALETTE[Math.floor(Math.random() * LIME_PALETTE.length)];
}

export function getRadialDelay(x, y, width, height, direction = false) {
  const dx = x - width * 0.5;
  const dy = direction ? y : y - height;
  return Math.sqrt(dx ** 2 + dy ** 2);
}

export class Pixel {
  constructor(x, y, color, speed, delay, delayHide, step, boundSize) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = rand(0.1, 0.9) * speed;
    this.size = 0;
    this.sizeStep = rand(0, 0.5);
    this.minSize = 0.5;
    this.maxSizeAvailable = boundSize || 2;
    this.maxSize = rand(this.minSize, this.maxSizeAvailable);
    this.sizeDirection = 1;
    this.delay = delay;
    this.delayHide = delayHide;
    this.counter = 0;
    this.counterHide = 0;
    this.counterStep = step;
    this.isHidden = false;
    this.isFlicking = false;
    this.noteMin = 24;
    this.noteMax = 96;
    this.regionId = 0;
    this.column = 0;
    this.row = 0;
  }

  draw(ctx) {
    const centerOffset = this.maxSizeAvailable * 0.5 - this.size * 0.5;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  show() {
    this.isHidden = false;
    this.counterHide = 0;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) {
      this.isFlicking = true;
    }
    if (this.isFlicking) {
      this.flicking();
    } else {
      this.size += this.sizeStep;
    }
  }

  hide() {
    this.counter = 0;
    if (this.counterHide <= this.delayHide) {
      this.counterHide += this.counterStep;
      if (this.isFlicking) {
        this.flicking();
      }
      return;
    }
    this.isFlicking = false;
    if (this.size <= 0) {
      this.size = 0;
      this.isHidden = true;
      return;
    }
    this.size -= 0.05;
  }

  flicking() {
    if (this.size >= this.maxSize) {
      this.sizeDirection = -1;
    } else if (this.size <= this.minSize) {
      this.sizeDirection = 1;
    }
    this.size += this.sizeDirection * this.speed;
  }
}

function randomRegions(columns, rows, count) {
  const regions = [];
  for (let i = 0; i < count; i += 1) {
    const width = Math.floor(rand(4, 14));
    const noteMin = Math.floor(rand(24, 96 - width));
    const colSpan = Math.max(1, Math.floor(rand(2, Math.max(2, columns * 0.45))));
    const rowSpan = Math.max(1, Math.floor(rand(2, Math.max(2, rows * 0.45))));
    const col0 = Math.floor(rand(0, Math.max(1, columns - colSpan)));
    const row0 = Math.floor(rand(0, Math.max(1, rows - rowSpan)));
    regions.push({
      id: i,
      noteMin,
      noteMax: noteMin + width,
      col0,
      col1: Math.min(columns - 1, col0 + colSpan),
      row0,
      row1: Math.min(rows - 1, row0 + rowSpan),
    });
  }
  return regions;
}

export function assignNoteRegions(pixels, columns, rows) {
  const regionCount = Math.min(14, Math.max(8, Math.floor((columns * rows) / 40)));
  const regions = randomRegions(columns, rows, regionCount);
  const defaultRegion = regions[0] ?? {
    id: 0,
    noteMin: 36,
    noteMax: 84,
    col0: 0,
    col1: columns - 1,
    row0: 0,
    row1: rows - 1,
  };

  for (const pixel of pixels) {
    const region =
      regions.find(
        (r) =>
          pixel.column >= r.col0 &&
          pixel.column <= r.col1 &&
          pixel.row >= r.row0 &&
          pixel.row <= r.row1,
      ) ?? defaultRegion;
    pixel.regionId = region.id;
    pixel.noteMin = region.noteMin;
    pixel.noteMax = region.noteMax;
  }

  return regions;
}

export function buildPixelGrid(width, height, gap = 6) {
  const maxSize = Math.max(2, Math.floor(gap * 0.5));
  const columns = Math.max(1, Math.floor(width / gap));
  const rows = Math.max(1, Math.floor(height / gap));
  const step = (width + height) * 0.005;
  const speed = rand(0.008, 0.25);
  const pixels = [];

  for (let x = 0; x < width; x += gap) {
    for (let y = 0; y < height; y += gap) {
      if (x + maxSize > width || y + maxSize > height) {
        continue;
      }
      const column = Math.floor(x / gap);
      const row = Math.floor(y / gap);
      const color = pickLimeColor();
      const delay = getRadialDelay(x, y, width, height);
      const delayHide = getRadialDelay(x, y, width, height, true);
      const pixel = new Pixel(x, y, color, speed, delay, delayHide, step, maxSize);
      pixel.column = column;
      pixel.row = row;
      pixels.push(pixel);
    }
  }

  assignNoteRegions(pixels, columns, rows);
  return { pixels, columns, rows, maxSize };
}
