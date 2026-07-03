export { StudioClient, type StudioClientOptions } from "./core/studio.js";
export { renderPreview } from "./core/preview.js";
export { scanProject, updateProjectCatalog } from "./core/scanner.js";
export type { FileSystemAdapter, FileStat } from "./core/fs/adapter.js";
export { MemoryFileSystemAdapter } from "./core/fs/memory-adapter.js";
export type {
  StudioProject,
  StudioAssetSummary,
  StudioSpecForm,
  StudioAssetDetail,
  StudioBrainOptions,
  StudioCategory,
} from "./core/types.js";
export { parseIntentToSpecs, type ParseIntentOptions } from "./ai/parse-intent.js";
export { setStorageBackend } from "./storage/pixode-storage.js";
