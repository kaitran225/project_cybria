export {
  StudioClient,
  type StudioClientOptions,
  renderPreview,
  scanProject,
  updateProjectCatalog,
  type FileSystemAdapter,
  type FileStat,
  MemoryFileSystemAdapter,
  type StudioProject,
  type StudioAssetSummary,
  type StudioSpecForm,
  type StudioAssetDetail,
  type StudioBrainOptions,
  type StudioCategory,
  type StudioCanvasContext,
  type SaveAssetResult,
  mutateAddLayer,
  mutateSetPixels,
  mutateRemovePixels,
  mutateUpdatePalette,
  mutateUpdateAnimations,
} from "./core/index.js";

export { CanvasEditor } from "./canvas/editor/canvas-editor.js";
export { LayerGrid } from "./canvas/editor/layer-grid.js";
export { HistoryStack, type Command } from "./canvas/editor/history.js";
export { ZOOM_PRESETS, fitZoom, scaleToPercent, nextZoomPreset } from "./canvas/editor/zoom-utils.js";
export * from "./canvas/editor/layer-ops.js";
export * from "./canvas/editor/palette-ops.js";
export {
  replaceDocumentPalette,
  mergeLibraryPaletteIntoDocument,
} from "./canvas/editor/palette-apply.js";
export {
  getMissingSnippetHexes,
  addMissingColorsToPalette,
} from "./canvas/editor/snippet-palette-utils.js";
export {
  applyGeneratedPixels,
  type AiApplyMode,
  type AiGenerationMeta,
  type ApplyGeneratedPixelsResult,
} from "./canvas/editor/ai-apply.js";
export * from "./canvas/editor/animation-ops.js";
export {
  renderDocumentToImageData,
  renderDocumentWithReferenceGhost,
  renderLayerToImageData,
  renderOnionFrames,
  mirrorX,
} from "./canvas/editor/render.js";
export type {
  CanvasTool,
  CanvasEditorState,
  Point,
  SelectionRect,
  ViewportSettings,
} from "./canvas/editor/types.js";
export {
  PixelCanvas,
  type PixelCanvasProps,
  type PixelCanvasHandle,
} from "./canvas/components/PixelCanvas.js";
export { Toolbox } from "./canvas/components/Toolbox.js";
export { SelectionBar } from "./canvas/components/SelectionBar.js";
export { FrameThumbnail } from "./canvas/components/FrameThumbnail.js";
export { LayerPanel } from "./canvas/components/LayerPanel.js";
export { PalettePanel } from "./canvas/components/PalettePanel.js";
export { PalettePicker } from "./canvas/components/PalettePicker.js";
export { PaletteCollectionsPanel } from "./canvas/components/PaletteCollectionsPanel.js";
export { ColorPicker } from "./canvas/components/ColorPicker.js";
export { HslStepSlider } from "./canvas/components/HslStepSlider.js";
export * from "./canvas/editor/color-utils.js";
export { LayerThumbnail } from "./canvas/components/LayerThumbnail.js";
export { ToolOptionsPanel } from "./canvas/components/ToolOptionsPanel.js";
export { drawCheckerboard } from "./canvas/editor/checkerboard.js";
export { renderSnippetPreviewDataUrl, renderSnippetPreviewCanvas } from "./canvas/editor/snippet-preview.js";
export { AnimationTimeline } from "./canvas/components/AnimationTimeline.js";
export { PropertiesPanel } from "./canvas/components/PropertiesPanel.js";
export { SnippetPixelEditor } from "./canvas/components/SnippetPixelEditor.js";

export { parseIntentToSpecs, type ParseIntentOptions } from "./ai/parse-intent.js";

export { SCHEMA_SQL } from "./state/schema.js";
export type {
  IndexedAsset,
  ProjectStatRow,
  ReviewQueueRow,
  StateStore,
} from "./state/store.js";
export { MemoryStateStore } from "./state/memory-store.js";
export { syncFromScan, type SyncAssetInput } from "./state/sync.js";
export { getDashboardData, type DashboardData } from "./state/queries.js";

export * from "./storage/types.js";
export * from "./storage/rle.js";
export * from "./storage/pixode-storage.js";
export * from "./storage/validate-import.js";
