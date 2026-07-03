import { normalizePath, type App, type TFile } from "obsidian";
import { ensureFolder } from "./vault-patterns";

export interface VaultPatternFs {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export function createVaultPatternFs(app: App, folder: string): VaultPatternFs {
  const root = () => normalizePath(folder);

  return {
    async readText(filePath: string): Promise<string> {
      const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
      if (file instanceof TFile) return app.vault.read(file);
      throw new Error(`Pattern not found: ${filePath}`);
    },

    async writeText(filePath: string, content: string): Promise<void> {
      const path = normalizePath(filePath);
      const existing = app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        await app.vault.modify(existing, content);
        return;
      }
      await ensureFolder(app, root());
      await app.vault.create(path, content);
    },

    async exists(filePath: string): Promise<boolean> {
      return app.vault.adapter.exists(normalizePath(filePath));
    },

    async listDir(dirPath: string): Promise<string[]> {
      const prefix = normalizePath(dirPath);
      if (!(await app.vault.adapter.exists(prefix))) return [];
      return app.vault
        .getFiles()
        .filter((f) => f.path.startsWith(`${prefix}/`) && f.extension === "strudel")
        .map((f) => f.name);
    },

    async mkdir(dirPath: string): Promise<void> {
      await ensureFolder(app, normalizePath(dirPath));
    },

    async remove(filePath: string): Promise<void> {
      const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
      if (file) await app.vault.delete(file);
    },
  };
}

export async function configureVaultPatterns(app: App, folder: string): Promise<void> {
  const { setVaultPatternFs, setProjectPatternsRoot, loadProjectPatternsFromDisk, loadDefaultProjectPattern } =
    await import("../vendor/cote-src/project-patterns.mjs");

  const normalized = normalizePath(folder);
  setVaultPatternFs(createVaultPatternFs(app, normalized));
  setProjectPatternsRoot(normalized);
  await loadProjectPatternsFromDisk(normalized);
  await loadDefaultProjectPattern(normalized);
}
