import { useCallback, useEffect, useRef, useState } from "react";
import { createSprite, type PaletteEntry, type PixelAssetDocument, type SparsePixel } from "@pixode/asset-core";
import { CanvasEditor } from "../editor/canvas-editor.js";
import { renderDocumentToImageData } from "../editor/render.js";

function snippetToDocument(
  width: number,
  height: number,
  pixels: SparsePixel[],
  palette: PaletteEntry[]
): PixelAssetDocument {
  const doc = createSprite({ id: "snippet_edit", width, height });
  doc.palette = palette.length > 0 ? palette : [{ id: 0, hex: "#000000" }];
  doc.layers[0].pixels = pixels;
  return doc;
}

export function SnippetPixelEditor({
  width,
  height,
  pixels: initialPixels,
  palette,
  activeColorId,
  onPixelsChange,
}: {
  width: number;
  height: number;
  pixels: SparsePixel[];
  palette: PaletteEntry[];
  activeColorId: number;
  onPixelsChange: (pixels: SparsePixel[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<CanvasEditor | null>(null);
  const [zoom] = useState(() =>
    Math.min(16, Math.floor(200 / Math.max(width, height)))
  );
  const isDrawing = useRef(false);

  useEffect(() => {
    const doc = snippetToDocument(width, height, initialPixels, palette);
    if (!editorRef.current) {
      editorRef.current = new CanvasEditor(doc);
    } else {
      editorRef.current.loadDocument(doc);
    }
    editorRef.current.setActiveColor(activeColorId);
    editorRef.current.setTool("pen");
    redraw();
  }, [width, height, initialPixels, palette, activeColorId]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const editor = editorRef.current;
    if (!canvas || !editor) return;
    const doc = editor.peekDocument();
    const imageData = renderDocumentToImageData(doc);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = width * zoom;
    canvas.height = height * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const off = globalThis.document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(off, 0, 0, width * zoom, height * zoom);
  }, [width, height, zoom]);

  const toPixel = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      y: Math.floor((e.clientY - rect.top) / zoom),
    };
  };

  const commit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const layer = editor.getDocument().layers[0];
    onPixelsChange(layer?.pixels ?? []);
    redraw();
  };

  return (
    <div className="snippet-pixel-editor">
      <canvas
        ref={canvasRef}
        className="snippet-pixel-editor-canvas"
        style={{
          width: width * zoom,
          height: height * zoom,
          imageRendering: "pixelated",
          cursor: "crosshair",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          isDrawing.current = true;
          const { x, y } = toPixel(e);
          editorRef.current?.pointerDown(x, y);
          redraw();
        }}
        onPointerMove={(e) => {
          if (!isDrawing.current) return;
          const { x, y } = toPixel(e);
          editorRef.current?.pointerMove(x, y);
          redraw();
        }}
        onPointerUp={(e) => {
          if (!isDrawing.current) return;
          isDrawing.current = false;
          const { x, y } = toPixel(e);
          editorRef.current?.pointerUp(x, y);
          commit();
        }}
        onPointerLeave={() => {
          if (!isDrawing.current) return;
          isDrawing.current = false;
          commit();
        }}
      />
      <p className="snippet-pixel-editor-hint">
        {width}×{height} · click/drag to paint
      </p>
    </div>
  );
}
