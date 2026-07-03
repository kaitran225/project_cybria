/** Canvas raster helper; studio preview uses CSS checkerboard in theme.css instead. */
export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sqSize = 8,
  lightA = "#F7F8F9",
  lightB = "#ECECEC"
): void {
  for (let y = 0; y < height; y += sqSize) {
    for (let x = 0; x < width; x += sqSize) {
      const idx = Math.floor(x / sqSize) + Math.floor(y / sqSize);
      ctx.fillStyle = idx % 2 === 0 ? lightA : lightB;
      ctx.fillRect(x, y, sqSize, sqSize);
    }
  }
}
