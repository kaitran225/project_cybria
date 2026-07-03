import "../canvas.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PixelAssetDocument, SparsePixel } from "@pixode/asset-core";
import { CanvasEditor } from "../editor/canvas-editor.js";
import { drawCanvasOverlays, drawSnippetDropPreview } from "../editor/overlay.js";
import {
  renderDocumentToImageData,
  renderDocumentWithReferenceGhost,
  renderOnionFrames,
} from "../editor/render.js";
import { nextZoomPreset } from "../editor/zoom-utils.js";
import type { CanvasTool, SelectionRect } from "../editor/types.js";

export interface PixelCanvasHandle {
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  applyExternalDocument: (doc: PixelAssetDocument, label: string) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteAt: (x: number, y: number) => void;
  deleteSelection: () => void;
  flipSelectionH: () => void;
  flipSelectionV: () => void;
  clearSelection: () => void;
  getSelection: () => SelectionRect | null;
  getViewportSize: () => { width: number; height: number };
  saveSelectionAsSnippet: () => {
    width: number;
    height: number;
    pixels: SparsePixel[];
  } | null;
  pasteSnippetAt: (
    snippet: { width: number; height: number; pixels: SparsePixel[] },
    x: number,
    y: number,
    options?: { center?: boolean; merge?: boolean }
  ) => void;
}

export interface PixelCanvasProps {
  document: PixelAssetDocument;
  activeLayerId: string;
  activeColorId: number;
  activeTool: CanvasTool;
  mirrorEnabled?: boolean;
  activeAnimationId?: string;
  activeFrameIndex?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  onPanChange?: (panX: number, panY: number) => void;
  onZoomChange?: (zoom: number) => void;
  showBounds?: boolean;
  showGrid?: boolean;
  showPixelGrid?: boolean;
  showCenterGuides?: boolean;
  showCheckerboard?: boolean;
  canvasPreviewMode?: "checker" | "white" | "dark";
  onionSkinEnabled?: boolean;
  brushSize?: number;
  referenceGhostEnabled?: boolean;
  referenceGhostOpacity?: number;
  spacePan?: boolean;
  onDocumentChange: (doc: PixelAssetDocument) => void;
  onColorPicked?: (colorId: number) => void;
  onPointerHover?: (pos: { x: number; y: number } | null) => void;
  onHistoryChange?: () => void;
  onSelectionChange?: (selection: SelectionRect | null) => void;
  resolveSnippet?: (id: string) => {
    width: number;
    height: number;
    pixels: SparsePixel[];
  } | null;
  draggingSnippetId?: string | null;
  interceptPointerDown?: (x: number, y: number) => boolean;
  onSnippetDrop?: (
    snippetId: string,
    x: number,
    y: number,
    modifiers: { center?: boolean; merge?: boolean }
  ) => void;
}

function blitImageData(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  zoom: number
): void {
  const { width, height } = imageData;
  if (typeof OffscreenCanvas !== "undefined") {
    const offscreen = new OffscreenCanvas(width, height);
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offscreen, 0, 0, width * zoom, height * zoom);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const offCtx = canvas.getContext("2d");
  if (!offCtx) return;
  offCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(canvas, 0, 0, width * zoom, height * zoom);
}

export const PixelCanvas = forwardRef<PixelCanvasHandle, PixelCanvasProps>(
  function PixelCanvas(
    {
      document: docProp,
      activeLayerId,
      activeColorId,
      activeTool,
      mirrorEnabled = false,
      activeAnimationId,
      activeFrameIndex = 0,
      zoom = 16,
      panX = 0,
      panY = 0,
      onPanChange,
      onZoomChange,
      showBounds = true,
      showGrid = false,
      showPixelGrid = false,
      showCenterGuides = false,
      showCheckerboard = true,
      canvasPreviewMode = "checker",
      onionSkinEnabled = false,
      brushSize = 1,
      referenceGhostEnabled = false,
      referenceGhostOpacity = 0.35,
      spacePan = false,
      onDocumentChange,
      onColorPicked,
      onPointerHover,
      onHistoryChange,
      onSelectionChange,
      resolveSnippet,
      draggingSnippetId = null,
      interceptPointerDown,
      onSnippetDrop,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<CanvasEditor | null>(null);
    const loadedAssetId = useRef<string | null>(null);
    const parentDocJsonRef = useRef<string>("");
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [snippetDrop, setSnippetDrop] = useState<{
      x: number;
      y: number;
      center: boolean;
      snippet: { width: number; height: number; pixels: SparsePixel[] };
    } | null>(null);
    const lastDropPreviewRef = useRef(0);
    const isDrawingRef = useRef(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    useEffect(() => {
      if (!editorRef.current) {
        editorRef.current = new CanvasEditor(docProp, onHistoryChange);
        loadedAssetId.current = docProp.id;
        return;
      }
      if (loadedAssetId.current !== docProp.id) {
        editorRef.current.loadDocument(docProp);
        loadedAssetId.current = docProp.id;
        parentDocJsonRef.current = JSON.stringify(docProp);
        onHistoryChange?.();
      }
    }, [docProp.id, docProp, onHistoryChange]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (activeAnimationId) {
        editor.setActiveFrame(activeAnimationId, activeFrameIndex);
      }
      editor.setActiveLayer(activeLayerId);
      editor.setActiveColor(activeColorId);
      editor.setTool(activeTool);
      editor.setZoom(zoom);
      editor.setMirror(mirrorEnabled);
      editor.setBrushSize(brushSize);
    }, [
      activeLayerId,
      activeColorId,
      activeTool,
      mirrorEnabled,
      brushSize,
      activeAnimationId,
      activeFrameIndex,
      zoom,
    ]);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const editor = editorRef.current;
      if (!canvas || !editor) return;

      const doc = editor.peekDocument();
      let imageData: ImageData;
      if (onionSkinEnabled && activeAnimationId) {
        imageData = renderOnionFrames(doc, activeAnimationId, activeFrameIndex);
      } else if (referenceGhostEnabled) {
        imageData = renderDocumentWithReferenceGhost(
          doc,
          activeLayerId,
          referenceGhostOpacity,
          activeAnimationId,
          activeFrameIndex
        );
      } else {
        imageData = renderDocumentToImageData(doc, activeAnimationId, activeFrameIndex);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = doc.canvas;
      canvas.width = width * zoom;
      canvas.height = height * zoom;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      blitImageData(ctx, imageData, zoom);

      if (overlay) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        const octx = overlay.getContext("2d");
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          drawCanvasOverlays(octx, width, height, zoom, {
            showBounds,
            showGrid,
            showPixelGrid,
            showCenterGuides,
            selection: editor.getSelection(),
          });
          if (snippetDrop) {
            drawSnippetDropPreview(
              octx,
              zoom,
              doc.palette,
              snippetDrop.snippet,
              snippetDrop.x,
              snippetDrop.y,
              { center: snippetDrop.center }
            );
          }
        }
      }

      onSelectionChange?.(editor.getSelection());
    }, [
      zoom,
      activeLayerId,
      activeAnimationId,
      activeFrameIndex,
      onionSkinEnabled,
      referenceGhostEnabled,
      referenceGhostOpacity,
      showBounds,
      showGrid,
      showPixelGrid,
      showCenterGuides,
      onSelectionChange,
      snippetDrop,
    ]);

    const commitDocument = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      onDocumentChange(editor.getDocument());
      redraw();
    }, [onDocumentChange, redraw]);

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const ok = editorRef.current?.undo() ?? false;
          if (ok) commitDocument();
          return ok;
        },
        redo: () => {
          const ok = editorRef.current?.redo() ?? false;
          if (ok) commitDocument();
          return ok;
        },
        canUndo: () => editorRef.current?.canUndo() ?? false,
        canRedo: () => editorRef.current?.canRedo() ?? false,
        applyExternalDocument: (doc, label) => {
          editorRef.current?.applyExternalDocument(doc, label);
          commitDocument();
          onHistoryChange?.();
        },
        copySelection: () => {
          editorRef.current?.copySelection();
        },
        cutSelection: () => {
          editorRef.current?.cutSelection();
          commitDocument();
        },
        pasteAt: (x, y) => {
          editorRef.current?.pasteClipboard(x, y);
          commitDocument();
        },
        deleteSelection: () => {
          editorRef.current?.deleteSelection();
          commitDocument();
        },
        flipSelectionH: () => {
          editorRef.current?.flipSelectionHorizontal();
          commitDocument();
        },
        flipSelectionV: () => {
          editorRef.current?.flipSelectionVertical();
          commitDocument();
        },
        clearSelection: () => {
          editorRef.current?.clearSelection();
          redraw();
        },
        getSelection: () => editorRef.current?.getSelection() ?? null,
        getViewportSize: () => {
          const el = viewportRef.current;
          return {
            width: el?.clientWidth ?? 600,
            height: el?.clientHeight ?? 400,
          };
        },
        saveSelectionAsSnippet: () =>
          editorRef.current?.extractSelectionAsSnippet() ?? null,
        pasteSnippetAt: (snippet, x, y, options) => {
          editorRef.current?.pasteSnippetPixels(snippet, x, y, options);
          commitDocument();
        },
      }),
      [commitDocument, redraw, onHistoryChange]
    );

    const handleDragOver = (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-pixode-snippet")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
      if (!draggingSnippetId || !resolveSnippet) return;
      const snippet = resolveSnippet(draggingSnippetId);
      if (!snippet) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / zoom);
      const y = Math.floor((e.clientY - rect.top) / zoom);
      const now = performance.now();
      if (now - lastDropPreviewRef.current < 33) return;
      lastDropPreviewRef.current = now;
      setSnippetDrop((prev) => {
        if (
          prev?.x === x &&
          prev?.y === y &&
          prev?.center === e.shiftKey &&
          prev.snippet === snippet
        ) {
          return prev;
        }
        return { x, y, center: e.shiftKey, snippet };
      });
    };

    const handleDragLeave = (e: React.DragEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      setSnippetDrop(null);
    };

    const handleDrop = (e: React.DragEvent) => {
      setSnippetDrop(null);
      const raw = e.dataTransfer.getData("application/x-pixode-snippet");
      if (!raw || !resolveSnippet) return;
      e.preventDefault();
      try {
        const { id } = JSON.parse(raw) as { id: string };
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / zoom);
        const y = Math.floor((e.clientY - rect.top) / zoom);
        const modifiers = { center: e.shiftKey, merge: e.altKey };
        if (onSnippetDrop) {
          onSnippetDrop(id, x, y, modifiers);
          return;
        }
        const snippet = resolveSnippet(id);
        if (!snippet) return;
        editorRef.current?.pasteSnippetPixels(snippet, x, y, modifiers);
        commitDocument();
      } catch {
        // ignore invalid payload
      }
    };

    const finishPointer = useCallback(
      (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
        if (isPanning) {
          setIsPanning(false);
          return;
        }
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        setIsDrawing(false);

        const editor = editorRef.current;
        if (!editor) return;

        const canvas = canvasRef.current;
        let x = 0;
        let y = 0;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          x = Math.floor((e.clientX - rect.left) / zoom);
          y = Math.floor((e.clientY - rect.top) / zoom);
        }

        const modified = editor.pointerUp(x, y);
        if (modified) {
          commitDocument();
        } else {
          redraw();
        }
      },
      [isPanning, zoom, commitDocument, redraw]
    );

    useEffect(() => {
      if (!isDrawing) return;
      const onWindowPointerUp = (e: PointerEvent) => finishPointer(e);
      window.addEventListener("pointerup", onWindowPointerUp);
      return () => window.removeEventListener("pointerup", onWindowPointerUp);
    }, [isDrawing, finishPointer]);

    useEffect(() => {
      if (isDrawing || !editorRef.current) return;
      if (loadedAssetId.current !== docProp.id) return;

      const parentJson = JSON.stringify(docProp);
      const editorJson = JSON.stringify(editorRef.current.getDocument());

      if (parentJson === editorJson) {
        parentDocJsonRef.current = parentJson;
        return;
      }

      if (parentJson !== parentDocJsonRef.current) {
        parentDocJsonRef.current = parentJson;
        editorRef.current.applyExternalDocument(docProp, "External sync");
        redraw();
      }
    }, [docProp, isDrawing, redraw]);

    useEffect(() => {
      if (!draggingSnippetId) setSnippetDrop(null);
    }, [draggingSnippetId]);

    useEffect(() => {
      redraw();
    }, [redraw, docProp.id, activeLayerId, activeFrameIndex, snippetDrop]);

    const toPixel = (e: React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / zoom);
      const y = Math.floor((e.clientY - rect.top) / zoom);
      return { x, y };
    };

    const handleWheel = (e: React.WheelEvent) => {
      if (!e.ctrlKey || !onZoomChange) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      onZoomChange(nextZoomPreset(zoom, dir as 1 | -1));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (spacePan || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
        return;
      }

      const editor = editorRef.current;
      const canvas = canvasRef.current;
      if (!editor || !canvas) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      setIsDrawing(true);
      const { x, y } = toPixel(e);
      if (interceptPointerDown?.(x, y)) return;
      editor.pointerDown(x, y);
      redraw();
      if (activeTool === "picker" && onColorPicked) {
        onColorPicked(editor.getState().activeColorId);
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPanning && onPanChange) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        onPanChange(panStart.current.panX + dx, panStart.current.panY + dy);
        return;
      }

      const { x, y } = toPixel(e);
      const { width, height } = docProp.canvas;
      if (x >= 0 && y >= 0 && x < width && y < height) {
        onPointerHover?.({ x, y });
      } else {
        onPointerHover?.(null);
      }

      if (!isDrawing) return;
      const editor = editorRef.current;
      if (!editor) return;
      e.preventDefault();
      editor.pointerMove(x, y);
      redraw();
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      finishPointer(e);
    };

    const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPanning) {
        setIsPanning(false);
      }
    };

    const { width, height } = docProp.canvas;

    return (
      <div
        ref={viewportRef}
        className="pixel-canvas-viewport"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onLostPointerCapture={handlePointerUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          cursor: spacePan || isPanning ? "grab" : "crosshair",
        }}
      >
        <div
          className="pixel-canvas-transform"
          style={{
            transform: `translate(${panX}px, ${panY}px)`,
          }}
        >
          <div
            className="pixel-canvas-wrap"
            style={{
              position: "relative",
              width: width * zoom,
              height: height * zoom,
            }}
          >
            {showCheckerboard && (
              <div
                className={`pixel-canvas-bg pixel-canvas-bg--${canvasPreviewMode}`}
                style={{
                  width: width * zoom,
                  height: height * zoom,
                  // One checker cell = half a painted pixel at current zoom
                  ["--pixel-checker-size" as string]: `${zoom / 2}px`,
                }}
                aria-hidden
              />
            )}
            <canvas
              ref={canvasRef}
              className="pixel-canvas"
              style={{
                position: "relative",
                zIndex: 1,
                width: width * zoom,
                height: height * zoom,
                imageRendering: "pixelated",
                touchAction: "none",
                display: "block",
              }}
            />
            <canvas
              ref={overlayRef}
              className="pixel-canvas-overlay"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 2,
                width: width * zoom,
                height: height * zoom,
                pointerEvents: "none",
                imageRendering: "pixelated",
              }}
            />
          </div>
        </div>
      </div>
    );
  }
);
