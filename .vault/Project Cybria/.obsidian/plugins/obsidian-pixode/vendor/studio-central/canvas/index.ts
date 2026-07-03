export { CanvasEditor } from "./editor/canvas-editor.js";
export { LayerGrid } from "./editor/layer-grid.js";
export { HistoryStack, type Command } from "./editor/history.js";
export { ZOOM_PRESETS, fitZoom, scaleToPercent, nextZoomPreset } from "./editor/zoom-utils.js";
export * from "./editor/layer-ops.js";
export * from "./editor/palette-ops.js";
export {
  replaceDocumentPalette,
  mergeLibraryPaletteIntoDocument,
} from "./editor/palette-apply.js";
export {
  getMissingSnippetHexes,
  addMissingColorsToPalette,
} from "./editor/snippet-palette-utils.js";
export {
  applyGeneratedPixels,
  type AiApplyMode,
  type AiGenerationMeta,
  type ApplyGeneratedPixelsResult,
} from "./editor/ai-apply.js";
export * from "./editor/animation-ops.js";
export {
  renderDocumentToImageData,
  renderDocumentWithReferenceGhost,
  renderLayerToImageData,
  renderOnionFrames,
  mirrorX,
} from "./editor/render.js";
export type {
  CanvasTool,
  CanvasEditorState,
  Point,
  SelectionRect,
  ViewportSettings,
} from "./editor/types.js";

export {
  PixelCanvas,
  type PixelCanvasProps,
  type PixelCanvasHandle,
} from "./components/PixelCanvas.js";
export { Toolbox } from "./components/Toolbox.js";
export { SelectionBar } from "./components/SelectionBar.js";
export { FrameThumbnail } from "./components/FrameThumbnail.js";
export { LayerPanel } from "./components/LayerPanel.js";
export { PalettePanel } from "./components/PalettePanel.js";
export { PalettePicker } from "./components/PalettePicker.js";
export { PaletteCollectionsPanel } from "./components/PaletteCollectionsPanel.js";
export { ColorPicker } from "./components/ColorPicker.js";
export { HslStepSlider } from "./components/HslStepSlider.js";
export * from "./editor/color-utils.js";
export { LayerThumbnail } from "./components/LayerThumbnail.js";
export { ToolOptionsPanel } from "./components/ToolOptionsPanel.js";
export { drawCheckerboard } from "./editor/checkerboard.js";
export { renderSnippetPreviewDataUrl, renderSnippetPreviewCanvas } from "./editor/snippet-preview.js";
export { AnimationTimeline } from "./components/AnimationTimeline.js";
export { PropertiesPanel } from "./components/PropertiesPanel.js";
export { SnippetPixelEditor } from "./components/SnippetPixelEditor.js";
