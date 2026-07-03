import { useEffect, useRef } from "react";
import type { PixelAssetDocument } from "@pixode/asset-core";
import { renderLayerToImageData } from "../editor/render.js";

export function LayerThumbnail({
  document,
  layerId,
  size = 24,
  animId,
  frameIndex = 0,
}: {
  document: PixelAssetDocument;
  layerId: string;
  size?: number;
  animId?: string;
  frameIndex?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layer = document.layers.find((l) => l.id === layerId);
  const pixelKey = layer?.pixels.map((p) => `${p.x},${p.y},${p.c}`).join("|") ?? "";
  const paletteKey = document.palette.map((p) => p.hex).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layer) return;
    const imageData = renderLayerToImageData(document, layerId, animId, frameIndex);
    const { width, height } = document.canvas;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const off = globalThis.document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);
    const scale = Math.min(size / width, size / height);
    const dw = width * scale;
    const dh = height * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    ctx.drawImage(off, 0, 0, width, height, dx, dy, dw, dh);
  }, [document, layerId, layer, pixelKey, paletteKey, size, animId, frameIndex]);

  if (!layer) return null;

  return (
    <canvas
      ref={canvasRef}
      className="canvas-layer-thumb"
      width={size}
      height={size}
      aria-hidden
    />
  );
}
