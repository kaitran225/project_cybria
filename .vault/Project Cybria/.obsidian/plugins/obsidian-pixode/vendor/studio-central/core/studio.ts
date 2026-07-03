import type {
  AnimationGraph,
  PaletteEntry,
  PixelAssetDocument,
  ReviewComment,
  SparsePixel,
} from "@pixode/asset-core";
import { createSprite } from "@pixode/asset-core";
import type { AssetCategory, AssetSpecification } from "@pixode/design";
import { parseStyle } from "@pixode/design";
import { parseProject, parseBrain } from "@pixode/asset-core/project";
import { analyzeProject } from "@pixode/quality";
import type { PixelProject } from "@pixode/asset-core/project";
import {
  MemoryStateStore,
  syncFromScan,
  getDashboardData,
  type StateStore,
  type IndexedAsset,
} from "../state/index.js";
import type { FileSystemAdapter } from "./fs/adapter.js";
import { scanProject, updateProjectCatalog } from "./scanner.js";
import { resolveUnderRoot } from "./paths.js";
import {
  scaffoldProject,
  slugifyProjectId,
  type ScaffoldProjectOptions,
} from "./project-template.js";
import { assetRelPath, canvasTypeForCategory } from "./asset-paths.js";
import { renderPreview } from "./preview.js";
import type {
  StudioAssetDetail,
  StudioAssetSummary,
  StudioBrainOptions,
  StudioCategory,
  StudioProject,
  StudioSpecForm,
  SaveAssetResult,
} from "./types.js";
import {
  DISABLED_REVIEW_REPORT,
  type DirectorReport,
} from "../types/review.js";
import { displayName, mapCategoryFilter } from "./studio-utils.js";
import {
  appendToCatalog,
  findStylePath,
  readProjectManifest,
} from "./project-lifecycle.js";
import {
  writeAssetFile,
  updateAssetDocument as persistAssetDocument,
  assetMutations,
  requireCachedAsset,
} from "./asset-repository.js";
import {
  saveSpecification as persistSpecification,
  getSpecForm as loadSpecForm,
  getSpecification as loadSpecification,
  listSpecs as listSpecEntries,
} from "./spec-service.js";
import {
  analyzeConsistency as runConsistencyAnalysis,
  generateVariants as runVariantGeneration,
  getAnalytics as loadAnalytics,
} from "./production-service.js";
export interface StudioClientOptions {
  fs: FileSystemAdapter;
  store?: StateStore;
}

export interface CreateAssetOptions {
  id: string;
  category: AssetCategory;
  width?: number;
  height?: number;
}

export class StudioClient {
  private fs: FileSystemAdapter;
  private store: StateStore;
  private rootPath = "";
  private assetCache = new Map<string, PixelAssetDocument>();
  private specCache = new Map<string, { spec: AssetSpecification; path: string }>();
  private reviewCache = new Map<string, DirectorReport>();
  private consistencyScore = 100;
  private styleViolations = 0;
  private projectId = "";
  private projectName = "";
  private projectManifest: PixelProject | null = null;

  constructor(options: StudioClientOptions) {
    this.fs = options.fs;
    this.store = options.store ?? new MemoryStateStore();
  }

  getRootPath(): string {
    return this.rootPath;
  }

  getStore(): StateStore {
    return this.store;
  }

  async isValidProjectRoot(rootPath: string): Promise<boolean> {
    const manifestPath = this.fs.join(rootPath, "pixode.project.json");
    return this.fs.exists(manifestPath);
  }

  async createProject(
    parentPath: string,
    options: ScaffoldProjectOptions
  ): Promise<StudioProject> {
    const rootPath = this.fs.join(parentPath, options.id);
    const manifestPath = this.fs.join(rootPath, "pixode.project.json");
    if (await this.fs.exists(manifestPath)) {
      throw new Error(`Project already exists at ${rootPath}`);
    }
    await scaffoldProject(this.fs, rootPath, options);
    return this.openProject(rootPath);
  }

  static slugifyProjectName(name: string): string {
    return slugifyProjectId(name);
  }

  async openProject(rootPath: string): Promise<StudioProject> {
    const scan = await scanProject(this.fs, rootPath);

    this.rootPath = rootPath;
    this.assetCache.clear();
    this.specCache.clear();
    this.reviewCache.clear();

    this.projectId = scan.project.id;
    this.projectName = scan.project.name;
    this.projectManifest = scan.project;
    await updateProjectCatalog(this.fs, rootPath, scan.catalog);

    for (const asset of scan.assets) {
      this.assetCache.set(asset.assetId, asset.document);
    }
    for (const spec of scan.specs) {
      this.specCache.set(spec.specId, {
        spec: spec.specification,
        path: spec.path,
      });
    }

    const docs = scan.assets.map((a) => a.document);
    const consistency = analyzeProject(docs);
    this.consistencyScore = consistency.score;

    syncFromScan(
      this.store,
      scan.assets.map((a) => ({
        document: a.document,
        path: a.path,
        category: a.category,
        specId: a.specId,
      })),
      scan.catalog
    );

    return this.getProject();
  }

  async createAsset(options: CreateAssetOptions): Promise<string> {
    if (!this.rootPath) throw new Error("No project open");

    const id = options.id.trim();
    if (!/^[a-z0-9_]+$/.test(id)) {
      throw new Error(
        "Asset id must use lowercase letters, numbers, and underscores only"
      );
    }
    if (this.assetCache.has(id)) {
      throw new Error(`Asset already exists: ${id}`);
    }

    const width = options.width ?? 16;
    const height = options.height ?? 16;
    const doc = createSprite({
      id,
      width,
      height,
      type: canvasTypeForCategory(options.category),
    });

    try {
      const manifest = await this.readProjectManifest();
      const stylePath = await findStylePath(this.fs, this.rootPath, manifest.defaultStyleId);
      const style = parseStyle(await this.fs.readText(stylePath));
      if (style.palette.length > 0) {
        doc.palette = style.palette.map((entry) => ({ ...entry }));
      }
      doc.styleRef = { styleId: style.id };
    } catch {
      /* default style optional */
    }

    const relPath = assetRelPath(options.category, id);
    await writeAssetFile(this.fs, this.rootPath, relPath, doc, this.assetCache);
    this.projectManifest = await appendToCatalog(
      this.fs,
      this.rootPath,
      id,
      relPath,
      options.category
    );

    this.store.upsertAsset({
      id,
      category: options.category,
      path: relPath,
      reviewStatus: "draft",
      updatedAt: new Date().toISOString(),
    });

    return id;
  }

  static slugifyAssetName(name: string): string {
    return slugifyProjectId(name);
  }

  getProject(): StudioProject {
    const dash = getDashboardData(this.store);
    return {
      id: this.projectId,
      name: this.projectName,
      rootPath: this.rootPath,
      stats: {
        characters: dash.stats.characters ?? 0,
        enemies: dash.stats.enemies ?? 0,
        items: dash.stats.items ?? 0,
        tilesets: dash.stats.tilesets ?? 0,
        ui: dash.stats.ui ?? 0,
        total: dash.totalAssets,
      },
      reviewQueue: dash.reviewQueue,
      styleViolations: this.styleViolations,
      consistencyScore: this.consistencyScore,
    };
  }

  async refreshProjectMeta(): Promise<StudioProject> {
    if (!this.rootPath) throw new Error("No project open");
    const manifest = await this.fs.readText(
      this.fs.join(this.rootPath, "pixode.project.json")
    );
    const project = parseProject(manifest);
    const docs = [...this.assetCache.values()];
    const consistency = analyzeProject(docs);
    this.consistencyScore = consistency.score;

    return {
      id: project.id,
      name: project.name,
      rootPath: this.rootPath,
      stats: {
        characters: this.store.getAssets("character").length,
        enemies: this.store.getAssets("enemy").length,
        items: this.store.getAssets("item").length,
        tilesets: this.store.getAssets("tileset").length,
        ui: this.store.getAssets("ui_icon").length,
        total: this.store.getAssets().length,
      },
      reviewQueue: this.store.getReviewQueue().length,
      styleViolations: this.styleViolations,
      consistencyScore: this.consistencyScore,
    };
  }

  listAssets(category?: StudioCategory): StudioAssetSummary[] {
    const filter = mapCategoryFilter(category);
    const rows = this.store.getAssets(filter);
    return rows.map((row: IndexedAsset) => {
      const doc = this.assetCache.get(row.id);
      const thumb = doc ? renderPreview(doc) : "";
      return {
        id: row.id,
        category: row.category,
        displayName: displayName(row.id),
        thumbnailUrl: thumb,
        reviewStatus: row.reviewStatus,
        directorScore: row.directorScore,
        specId: row.specId,
        path: row.path,
      };
    });
  }

  async getAssetDetail(assetId: string): Promise<StudioAssetDetail | null> {
    const row = this.store.getAsset(assetId);
    if (!row) return null;

    let doc = this.assetCache.get(assetId);
    if (!doc) {
      const fullPath = resolveUnderRoot(this.rootPath, row.path);
      const json = await this.fs.readText(fullPath);
      doc = JSON.parse(json) as PixelAssetDocument;
      this.assetCache.set(assetId, doc);
    }

    const specEntry = row.specId ? this.specCache.get(row.specId) : undefined;
    const report = this.reviewCache.get(assetId);

    return {
      id: assetId,
      category: row.category,
      displayName: displayName(assetId),
      document: doc,
      spec: specEntry?.spec,
      specPath: specEntry?.path,
      assetPath: row.path,
      reviewReport: report,
      generationInfo: doc.generation?.current
        ? {
            specId: doc.specRef?.specId ?? doc.generation.current.specId,
            backend: doc.generation.current.backend,
            seed: doc.generation.current.seed
              ? parseInt(String(doc.generation.current.seed), 10)
              : undefined,
          }
        : undefined,
    };
  }

  renderAssetPreview(assetId: string): string {
    const doc = this.assetCache.get(assetId);
    if (!doc) throw new Error(`Asset not found: ${assetId}`);
    return renderPreview(doc);
  }

  async saveSpecification(form: StudioSpecForm): Promise<string> {
    if (!this.rootPath) throw new Error("No project open");
    return persistSpecification(this.fs, this.rootPath, this.specCache, form);
  }

  async getSpecForm(specId: string): Promise<StudioSpecForm | null> {
    return loadSpecForm(this.specCache, specId);
  }

  getSpecification(specId: string): AssetSpecification | null {
    return loadSpecification(this.specCache, specId);
  }

  async loadBrainOptions(): Promise<StudioBrainOptions> {
    if (!this.rootPath) {
      return { species: [], themes: [], factions: [], blueprintIds: [], styleIds: [] };
    }
    const manifest = await this.fs.readText(
      this.fs.join(this.rootPath, "pixode.project.json")
    );
    const project = parseProject(manifest);
    const brainPath = this.fs.join(this.rootPath, project.brainPath, "project-brain.json");
    const brain = parseBrain(await this.fs.readText(brainPath));

    const blueprintIds = new Set<string>();
    const styleIds = new Set<string>([project.defaultStyleId]);

    for (const [, entry] of this.specCache) {
      blueprintIds.add(entry.spec.blueprintId);
      styleIds.add(entry.spec.styleId);
    }

    return {
      species: brain.races.map((r) => r.id),
      themes: Object.keys(brain.biomePalettes ?? {}),
      factions: brain.factions.map((f) => f.id),
      blueprintIds: [...blueprintIds],
      styleIds: [...styleIds],
    };
  }

  async loadStyle(styleId: string): Promise<import("@pixode/design").PixelStyle> {
    if (!this.rootPath) throw new Error("No project open");
    const stylePath = await findStylePath(this.fs, this.rootPath, styleId);
    return parseStyle(await this.fs.readText(stylePath));
  }

  async runReview(assetId: string): Promise<DirectorReport> {
    if (!this.assetCache.get(assetId)) throw new Error(`Asset not found: ${assetId}`);
    this.reviewCache.set(assetId, DISABLED_REVIEW_REPORT);
    return DISABLED_REVIEW_REPORT;
  }

  async approveAsset(assetId: string, by: string): Promise<void> {
    const doc = this.assetCache.get(assetId);
    if (!doc) throw new Error(`Asset not found: ${assetId}`);
    if (!this.store.getAsset(assetId)) throw new Error(`Asset not indexed: ${assetId}`);

    const updated: PixelAssetDocument = {
      ...doc,
      review: {
        status: "approved",
        comments: doc.review?.comments ?? [],
        approvedBy: by,
        approvedAt: new Date().toISOString(),
      },
    };
    await this.updateAssetDocument(assetId, updated);
  }

  async requestChanges(
    assetId: string,
    message: string,
    author: string,
    region?: string
  ): Promise<void> {
    const doc = this.assetCache.get(assetId);
    if (!doc) throw new Error(`Asset not found: ${assetId}`);
    if (!this.store.getAsset(assetId)) throw new Error(`Asset not indexed: ${assetId}`);

    const comment: ReviewComment = {
      id: `c_${Date.now()}`,
      author,
      message,
      region,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    const updated: PixelAssetDocument = {
      ...doc,
      review: {
        status: "changes_requested",
        comments: [...(doc.review?.comments ?? []), comment],
      },
    };
    await this.updateAssetDocument(assetId, updated);
  }

  async fixAutomatically(_assetId: string): Promise<void> {
    // Review auto-fix disabled with AI removal.
  }

  getCachedDocument(assetId: string): PixelAssetDocument | undefined {
    return this.assetCache.get(assetId);
  }

  async updateAssetDocument(
    assetId: string,
    doc: PixelAssetDocument,
    options?: { rescan?: boolean }
  ): Promise<SaveAssetResult> {
    return persistAssetDocument(
      this.fs,
      this.rootPath,
      this.store,
      this.assetCache,
      assetId,
      doc,
      {
        rescan: options?.rescan,
        rescanProject: (root) => this.openProject(root).then(() => undefined),
      }
    );
  }

  async addLayer(
    assetId: string,
    layerId: string,
    name: string
  ): Promise<PixelAssetDocument> {
    const doc = requireCachedAsset(this.assetCache, assetId);
    const updated = assetMutations.addLayer(doc, layerId, name);
    await this.updateAssetDocument(assetId, updated);
    return updated;
  }

  async setPixels(
    assetId: string,
    layerId: string,
    pixels: SparsePixel[]
  ): Promise<PixelAssetDocument> {
    const doc = requireCachedAsset(this.assetCache, assetId);
    const updated = assetMutations.setPixels(doc, layerId, pixels);
    await this.updateAssetDocument(assetId, updated);
    return updated;
  }

  async removePixels(
    assetId: string,
    layerId: string,
    positions: Array<{ x: number; y: number }>
  ): Promise<PixelAssetDocument> {
    const doc = requireCachedAsset(this.assetCache, assetId);
    const updated = assetMutations.removePixels(doc, layerId, positions);
    await this.updateAssetDocument(assetId, updated);
    return updated;
  }

  async updatePalette(
    assetId: string,
    palette: PaletteEntry[]
  ): Promise<PixelAssetDocument> {
    const doc = requireCachedAsset(this.assetCache, assetId);
    const updated = assetMutations.updatePalette(doc, palette);
    await this.updateAssetDocument(assetId, updated);
    return updated;
  }

  async updateAnimations(
    assetId: string,
    animations: AnimationGraph
  ): Promise<PixelAssetDocument> {
    const doc = requireCachedAsset(this.assetCache, assetId);
    const updated = assetMutations.updateAnimations(doc, animations);
    await this.updateAssetDocument(assetId, updated);
    return updated;
  }

  async generateVariants(baseId: string, variantSetPath: string): Promise<string[]> {
    return runVariantGeneration(
      this.fs,
      this.rootPath,
      this.assetCache,
      baseId,
      variantSetPath,
      (root) => this.openProject(root).then(() => undefined)
    );
  }

  analyzeConsistency(category?: StudioCategory) {
    return runConsistencyAnalysis(this.assetCache, this.store, category);
  }

  async readProjectManifest(): Promise<PixelProject> {
    return readProjectManifest(this.fs, this.rootPath, this.projectManifest);
  }

  getAllAssetDocuments(): PixelAssetDocument[] {
    return [...this.assetCache.values()];
  }

  getProjectRoot(): string {
    return this.rootPath;
  }

  async getAnalytics() {
    return loadAnalytics(this.fs, this.rootPath);
  }

  listSpecs(): Array<{ id: string; displayName: string; category: string }> {
    return listSpecEntries(this.specCache);
  }
}
