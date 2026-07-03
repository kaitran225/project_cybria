export { StudioClient, type StudioClientOptions } from "./studio.js";
export { renderPreview } from "./preview.js";
export { scanProject, updateProjectCatalog } from "./scanner.js";
export {
  scaffoldProject,
  slugifyProjectId,
  type ScaffoldProjectOptions,
} from "./project-template.js";
export {
  assetRelPath,
  slugifyAssetId,
  assetFolderForCategory,
} from "./asset-paths.js";
export type { CreateAssetOptions } from "./studio.js";
export type { FileSystemAdapter, FileStat } from "./fs/adapter.js";
export { MemoryFileSystemAdapter } from "./fs/memory-adapter.js";
export type {
  StudioProject,
  StudioAssetSummary,
  StudioSpecForm,
  StudioAssetDetail,
  StudioBrainOptions,
  StudioCategory,
  StudioCanvasContext,
  SaveAssetResult,
} from "./types.js";
export {
  mutateAddLayer,
  mutateSetPixels,
  mutateRemovePixels,
  mutateUpdatePalette,
  mutateUpdateAnimations,
} from "./mutations.js";
