import type { PixelAssetDocument, SparsePixel } from "@pixode/asset-core";
import type { CanvasEditorState, CanvasTool, Point, SelectionRect } from "./types.js";
import { isPointInSelection, normalizeSelection } from "./types.js";
import { LayerGrid } from "./layer-grid.js";
import { updateLayerPixels } from "./layer-ops.js";
import { linePoints } from "./brush-utils.js";
import { mirrorX } from "./render.js";
import { HistoryStack } from "./history.js";
import { LayerGridCommand } from "./commands/layer-grid-command.js";
import { DocumentPatchCommand } from "./commands/document-patch-command.js";
import { resolveActiveLayerForFrame } from "./animation-ops.js";

export class CanvasEditor {
  private state: CanvasEditorState;
  private layerGrid: LayerGrid;
  private rectStart: Point | null = null;
  private selectStart: Point | null = null;
  private moveDrag: {
    buffer: Int16Array;
    w: number;
    h: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null = null;
  private gestureBefore: LayerGrid | null = null;
  private history = new HistoryStack();
  private onHistoryChange?: () => void;
  private clipboard: {
    data: Int16Array;
    w: number;
    h: number;
  } | null = null;
  private lastStrokePoint: Point | null = null;

  constructor(doc: PixelAssetDocument, onHistoryChange?: () => void) {
    this.onHistoryChange = onHistoryChange;
    const activeLayerId = doc.layers[0]?.id ?? "base";
    const activeAnimationId = doc.animations?.states[0]?.id ?? "idle";
    this.state = {
      document: structuredClone(doc),
      activeLayerId,
      activeColorId: doc.palette[0]?.id ?? 0,
      activeTool: "pen",
      brushSize: 1,
      zoom: 16,
      mirrorEnabled: false,
      activeAnimationId,
      activeFrameIndex: 0,
      selection: null,
    };
    const layer = doc.layers.find((l) => l.id === activeLayerId);
    this.layerGrid = new LayerGrid(doc.canvas.width, doc.canvas.height, layer);
  }

  getState(): CanvasEditorState {
    return this.state;
  }

  getSelection(): SelectionRect | null {
    return this.state.selection;
  }

  getDocument(): PixelAssetDocument {
    this.flushGrid();
    return this.state.document;
  }

  peekDocument(): PixelAssetDocument {
    const pixels = this.layerGrid.toSparsePixels();
    return updateLayerPixels(
      this.state.document,
      this.state.activeLayerId,
      pixels
    );
  }

  loadDocument(doc: PixelAssetDocument): void {
    this.history.clear();
    this.state.document = structuredClone(doc);
    this.state.activeLayerId = doc.layers[0]?.id ?? "base";
    this.state.activeColorId = doc.palette[0]?.id ?? 0;
    this.state.activeAnimationId = doc.animations?.states[0]?.id ?? "idle";
    this.state.activeFrameIndex = 0;
    this.state.selection = null;
    this.reloadGrid();
    this.notifyHistory();
  }

  applyExternalDocument(doc: PixelAssetDocument, label: string): void {
    const before = structuredClone(this.state.document);
    this.pushDocumentPatch(before, doc, label);
  }

  setTool(tool: CanvasTool): void {
    this.state.activeTool = tool;
  }

  setActiveColor(colorId: number): void {
    this.state.activeColorId = colorId;
  }

  setActiveLayer(layerId: string): void {
    const frameLayerIds = this.getFrameLayerIds(
      this.state.activeAnimationId,
      this.state.activeFrameIndex
    );
    const resolved =
      frameLayerIds.length > 0 && !frameLayerIds.includes(layerId)
        ? frameLayerIds[frameLayerIds.length - 1]
        : layerId;
    if (resolved === this.state.activeLayerId) return;
    this.flushGrid();
    this.state.activeLayerId = resolved;
    this.reloadGrid();
  }

  setZoom(zoom: number): void {
    this.state.zoom = Math.max(1, Math.min(256, zoom));
  }

  setMirror(enabled: boolean): void {
    this.state.mirrorEnabled = enabled;
    if (enabled) this.state.activeTool = "mirror";
  }

  setBrushSize(size: number): void {
    this.state.brushSize = Math.max(1, Math.min(8, Math.round(size)));
  }

  setActiveFrame(animId: string, frameIndex: number): void {
    const sameFrame =
      animId === this.state.activeAnimationId &&
      frameIndex === this.state.activeFrameIndex;
    const frameLayerIds = this.getFrameLayerIds(animId, frameIndex);
    const layerMismatch =
      frameLayerIds.length > 0 &&
      !frameLayerIds.includes(this.state.activeLayerId);
    if (sameFrame && !layerMismatch) return;

    if (!sameFrame) {
      this.flushGrid();
      this.state.activeAnimationId = animId;
      this.state.activeFrameIndex = frameIndex;
    }
    this.syncActiveLayerToFrame(animId, frameIndex);
    this.reloadGrid();
  }

  private syncActiveLayerToFrame(animId: string, frameIndex: number): void {
    const resolved = resolveActiveLayerForFrame(
      this.state.document,
      animId,
      frameIndex
    );
    if (resolved && resolved !== this.state.activeLayerId) {
      this.state.activeLayerId = resolved;
    }
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  undo(): boolean {
    const ok = this.history.undo();
    if (ok) {
      this.reloadGrid();
      this.notifyHistory();
    }
    return ok;
  }

  redo(): boolean {
    const ok = this.history.redo();
    if (ok) {
      this.reloadGrid();
      this.notifyHistory();
    }
    return ok;
  }

  clearSelection(): void {
    this.state.selection = null;
  }

  copySelection(): void {
    const sel = this.state.selection;
    if (!sel) return;
    const { minX, maxX, minY, maxY, w, h } = normalizeSelection(sel);
    this.clipboard = {
      data: this.layerGrid.extractRegion(minX, minY, maxX, maxY),
      w,
      h,
    };
  }

  cutSelection(): void {
    this.copySelection();
    this.deleteSelection();
  }

  pasteClipboard(x: number, y: number): void {
    if (!this.clipboard) return;
    const before = this.layerGrid.clone();
    this.layerGrid.pasteRegion(x, y, this.clipboard.w, this.clipboard.h, this.clipboard.data);
    this.pushGridCommand("Paste", before, this.layerGrid.clone());
    this.flushGrid();
  }

  extractSelectionAsSnippet(): {
    width: number;
    height: number;
    pixels: SparsePixel[];
  } | null {
    const sel = this.state.selection;
    if (!sel) return null;
    const { minX, maxX, minY, maxY, w, h } = normalizeSelection(sel);
    const data = this.layerGrid.extractRegion(minX, minY, maxX, maxY);
    const pixels: SparsePixel[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = data[y * w + x];
        if (c >= 0) pixels.push({ x, y, c });
      }
    }
    return { width: w, height: h, pixels };
  }

  pasteSnippetPixels(
    snippet: { width: number; height: number; pixels: SparsePixel[] },
    originX: number,
    originY: number,
    options?: { merge?: boolean; center?: boolean }
  ): void {
    let ox = originX;
    let oy = originY;
    if (options?.center) {
      ox = originX - Math.floor(snippet.width / 2);
      oy = originY - Math.floor(snippet.height / 2);
    }
    const before = this.layerGrid.clone();
    for (const p of snippet.pixels) {
      const tx = ox + p.x;
      const ty = oy + p.y;
      if (tx < 0 || ty < 0 || tx >= this.layerGrid.width || ty >= this.layerGrid.height) {
        continue;
      }
      if (options?.merge && this.layerGrid.get(tx, ty) !== -1) {
        continue;
      }
      if (p.a !== undefined && p.a < 1) {
        // partial alpha: still set color id for now
      }
      this.layerGrid.set(tx, ty, p.c);
    }
    this.pushGridCommand("Paste snippet", before, this.layerGrid.clone());
    this.flushGrid();
  }

  deleteSelection(): void {
    const sel = this.state.selection;
    if (!sel) return;
    const before = this.layerGrid.clone();
    this.layerGrid.clearRegion(sel.x0, sel.y0, sel.x1, sel.y1);
    this.pushGridCommand("Delete selection", before, this.layerGrid.clone());
    this.state.selection = null;
    this.flushGrid();
  }

  flipSelectionHorizontal(): void {
    const sel = this.state.selection;
    if (!sel) return;
    const before = this.layerGrid.clone();
    this.layerGrid.flipRegionH(sel.x0, sel.y0, sel.x1, sel.y1);
    this.pushGridCommand("Flip H", before, this.layerGrid.clone());
    this.flushGrid();
  }

  flipSelectionVertical(): void {
    const sel = this.state.selection;
    if (!sel) return;
    const before = this.layerGrid.clone();
    this.layerGrid.flipRegionV(sel.x0, sel.y0, sel.x1, sel.y1);
    this.pushGridCommand("Flip V", before, this.layerGrid.clone());
    this.flushGrid();
  }

  private getFrameLayerIds(animId: string, frameIndex: number): string[] {
    const states = this.state.document.animations?.states ?? [];
    const anim = states.find((s) => s.id === animId);
    return anim?.frames[frameIndex]?.layerIds ?? this.state.document.layers.map((l) => l.id);
  }

  private reloadGrid(): void {
    const layer = this.state.document.layers.find(
      (l) => l.id === this.state.activeLayerId
    );
    this.layerGrid = new LayerGrid(
      this.state.document.canvas.width,
      this.state.document.canvas.height,
      layer
    );
  }

  private restoreGridData(data: Int16Array): void {
    this.layerGrid.restoreData(data);
    this.flushGrid();
  }

  private flushGrid(): void {
    const pixels = this.layerGrid.toSparsePixels();
    this.state.document = updateLayerPixels(
      this.state.document,
      this.state.activeLayerId,
      pixels
    );
  }

  private pushGridCommand(label: string, before: LayerGrid, after: LayerGrid): void {
    if (before.equals(after)) return;
    this.history.push(
      new LayerGridCommand(label, before, after, (data) => this.restoreGridData(data))
    );
    this.notifyHistory();
  }

  private pushDocumentPatch(
    before: PixelAssetDocument,
    after: PixelAssetDocument,
    label: string
  ): void {
    this.history.push(
      new DocumentPatchCommand(label, before, after, (doc) => {
        this.state.document = structuredClone(doc);
        this.state.activeLayerId = doc.layers[0]?.id ?? this.state.activeLayerId;
        if (!doc.layers.some((l) => l.id === this.state.activeLayerId)) {
          this.state.activeLayerId = doc.layers[0]?.id ?? "base";
        }
        this.reloadGrid();
      })
    );
    this.state.document = structuredClone(after);
    this.syncActiveLayerToFrame(
      this.state.activeAnimationId,
      this.state.activeFrameIndex
    );
    this.reloadGrid();
    this.notifyHistory();
  }

  private notifyHistory(): void {
    this.onHistoryChange?.();
  }

  private beginGesture(): void {
    this.gestureBefore = this.layerGrid.clone();
  }

  private endGesture(label: string): void {
    if (!this.gestureBefore) return;
    const after = this.layerGrid.clone();
    this.pushGridCommand(label, this.gestureBefore, after);
    this.gestureBefore = null;
    this.flushGrid();
  }

  private startMoveDrag(x: number, y: number): void {
    const sel = this.state.selection;
    if (!sel) return;
    const { minX, maxX, minY, maxY, w, h } = normalizeSelection(sel);
    this.beginGesture();
    this.moveDrag = {
      buffer: this.layerGrid.extractRegion(minX, minY, maxX, maxY),
      w,
      h,
      originX: minX,
      originY: minY,
      startX: x,
      startY: y,
    };
    this.layerGrid.clearRegion(minX, minY, maxX, maxY);
    this.applyMovePreview(x, y);
  }

  private applyMovePreview(x: number, y: number): void {
    if (!this.moveDrag || !this.gestureBefore) return;
    const { buffer, w, h, originX, originY, startX, startY } = this.moveDrag;
    const dx = x - startX;
    const dy = y - startY;
    const destX = originX + dx;
    const destY = originY + dy;

    this.layerGrid.restoreData(this.gestureBefore.cloneData());
    this.layerGrid.clearRegion(originX, originY, originX + w - 1, originY + h - 1);
    this.layerGrid.pasteRegion(destX, destY, w, h, buffer);

    this.state.selection = {
      x0: destX,
      y0: destY,
      x1: destX + w - 1,
      y1: destY + h - 1,
    };
  }

  private endMoveDrag(): boolean {
    if (!this.moveDrag) return false;
    this.endGesture("Move selection");
    this.moveDrag = null;
    this.selectStart = null;
    return true;
  }

  pointerDown(x: number, y: number): void {
    const { activeTool, activeColorId, document: doc } = this.state;

    if (activeTool === "picker") {
      const layer = doc.layers.find((l) => l.id === this.state.activeLayerId);
      const px = layer?.pixels.find((p) => p.x === x && p.y === y);
      if (px) this.state.activeColorId = px.c;
      return;
    }

    if (activeTool === "select") {
      if (
        this.state.selection &&
        isPointInSelection(x, y, this.state.selection)
      ) {
        this.startMoveDrag(x, y);
        return;
      }
      this.moveDrag = null;
      this.selectStart = { x, y };
      this.state.selection = { x0: x, y0: y, x1: x, y1: y };
      return;
    }

    if (activeTool === "move") {
      if (!this.state.selection) return;
      this.startMoveDrag(x, y);
      return;
    }

    if (activeTool === "fill") {
      this.beginGesture();
      this.layerGrid.floodFill(x, y, activeColorId);
      this.endGesture("Fill");
      return;
    }

    if (activeTool === "rectangle") {
      this.rectStart = { x, y };
      this.beginGesture();
      return;
    }

    this.beginGesture();
    this.lastStrokePoint = { x, y };
    this.applyStroke(x, y);
  }

  pointerMove(x: number, y: number): void {
    const tool = this.state.activeTool;

    if (this.moveDrag && (tool === "select" || tool === "move")) {
      this.applyMovePreview(x, y);
      return;
    }

    if (tool === "select" && this.selectStart) {
      this.state.selection = {
        x0: this.selectStart.x,
        y0: this.selectStart.y,
        x1: x,
        y1: y,
      };
      return;
    }

    if (tool !== "pen" && tool !== "erase" && tool !== "mirror") return;
    if (this.lastStrokePoint) {
      const points = linePoints(
        this.lastStrokePoint.x,
        this.lastStrokePoint.y,
        x,
        y
      );
      for (const p of points) {
        this.applyStroke(p.x, p.y);
      }
    } else {
      this.applyStroke(x, y);
    }
    this.lastStrokePoint = { x, y };
  }

  pointerUp(x: number, y: number): boolean {
    if (this.moveDrag && (this.state.activeTool === "select" || this.state.activeTool === "move")) {
      this.applyMovePreview(x, y);
      return this.endMoveDrag();
    }

    // Fill is applied immediately on pointerDown; pointerUp should still report "modified"
    // so the UI commits the updated document (and save/undo state stays consistent).
    if (this.state.activeTool === "fill") {
      return true;
    }

    if (this.state.activeTool === "select") {
      if (this.selectStart) {
        this.state.selection = {
          x0: this.selectStart.x,
          y0: this.selectStart.y,
          x1: x,
          y1: y,
        };
      }
      this.selectStart = null;
      return false;
    }

    if (this.state.activeTool === "move") {
      return false;
    }

    if (this.state.activeTool === "rectangle" && this.rectStart) {
      this.layerGrid.fillRect(
        this.rectStart.x,
        this.rectStart.y,
        x,
        y,
        this.state.activeColorId
      );
      this.rectStart = null;
      this.endGesture("Rectangle");
      return true;
    }

    const strokeTools: CanvasTool[] = ["pen", "erase", "mirror"];
    if (strokeTools.includes(this.state.activeTool)) {
      if (this.lastStrokePoint) {
        const points = linePoints(
          this.lastStrokePoint.x,
          this.lastStrokePoint.y,
          x,
          y
        );
        for (const p of points) {
          this.applyStroke(p.x, p.y);
        }
      } else {
        this.applyStroke(x, y);
      }
      this.lastStrokePoint = null;
      this.endGesture(this.state.activeTool === "erase" ? "Erase" : "Paint");
      return true;
    }

    return false;
  }

  private applyStroke(x: number, y: number): void {
    const { activeTool, activeColorId, mirrorEnabled, brushSize, document: doc } =
      this.state;
    const w = doc.canvas.width;

    const paint = (px: number, py: number) => {
      if (activeTool === "erase") {
        this.layerGrid.clearSquare(px, py, brushSize);
      } else {
        this.layerGrid.paintSquare(px, py, brushSize, activeColorId);
      }
    };

    paint(x, y);
    if (mirrorEnabled || activeTool === "mirror") {
      paint(mirrorX(x, w), y);
    }
  }
}
