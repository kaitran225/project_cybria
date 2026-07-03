import { memo, useEffect, useRef } from "react";
import type { PixelAssetDocument } from "@pixode/asset-core";
import { renderDocumentToImageData } from "../editor/render.js";

export const FrameThumbnail = memo(function FrameThumbnail({
  document,
  animId,
  frameIndex,
  size = 32,
  active = false,
  label,
  onClick,
}: {
  document: PixelAssetDocument;
  animId: string;
  frameIndex: number;
  size?: number;
  active?: boolean;
  label?: string;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const imageData = renderDocumentToImageData(document, animId, frameIndex);
    const scale = size / Math.max(imageData.width, imageData.height);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const off = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(imageData.width, imageData.height)
      : (() => {
          const c = window.document.createElement("canvas");
          c.width = imageData.width;
          c.height = imageData.height;
          return c;
        })();
    const offCtx = off.getContext("2d") as CanvasRenderingContext2D | null;
    if (offCtx) {
      offCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(
        off as CanvasImageSource,
        0,
        0,
        imageData.width * scale,
        imageData.height * scale
      );
    }
  }, [document, animId, frameIndex, size]);

  return (
    <button
      type="button"
      className={`canvas-frame-thumb${active ? " active" : ""}`}
      onClick={onClick}
      title={`Frame ${frameIndex + 1}`}
    >
      <canvas ref={ref} width={size} height={size} />
      {label && <span className="canvas-frame-thumb-label">{label}</span>}
    </button>
  );
});
