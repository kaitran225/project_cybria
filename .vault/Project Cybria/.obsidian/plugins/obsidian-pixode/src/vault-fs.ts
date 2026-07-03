import { normalizePath, type App } from "obsidian";
import type { FileSystemAdapter } from "@pixode/studio-central/core/fs/adapter.js";

export function createVaultFileSystem(app: App): FileSystemAdapter {
  const adapter = app.vault.adapter;

  return {
    async readText(filePath: string): Promise<string> {
      return adapter.read(normalizePath(filePath));
    },
    async writeText(filePath: string, content: string): Promise<void> {
      const p = normalizePath(filePath);
      const slash = p.lastIndexOf("/");
      if (slash > 0) {
        await ensureFolder(app, p.slice(0, slash));
      }
      await adapter.write(p, content);
    },
    async exists(filePath: string): Promise<boolean> {
      return adapter.exists(normalizePath(filePath));
    },
    async stat(filePath: string) {
      const p = normalizePath(filePath);
      if (!(await adapter.exists(p))) return null;
      const statFn = (adapter as { stat?: (path: string) => Promise<{ type: string }> }).stat;
      if (statFn) {
        try {
          const s = await statFn.call(adapter, p);
          return { isDirectory: s.type === "folder", isFile: s.type === "file" };
        } catch {
          return null;
        }
      }
      try {
        await adapter.list(p);
        return { isDirectory: true, isFile: false };
      } catch {
        return { isDirectory: false, isFile: true };
      }
    },
    async listDir(dirPath: string): Promise<string[]> {
      const p = normalizePath(dirPath);
      if (!(await adapter.exists(p))) return [];
      const listing = await adapter.list(p);
      const names = new Set<string>();
      for (const entry of [...listing.files, ...listing.folders]) {
        const norm = entry.replace(/\\/g, "/");
        const base = norm.slice(norm.lastIndexOf("/") + 1);
        if (base) names.add(base);
      }
      return [...names];
    },
    join(...parts: string[]): string {
      return normalizePath(parts.filter(Boolean).join("/").replace(/\\/g, "/"));
    },
    basename(filePath: string): string {
      const p = filePath.replace(/\\/g, "/");
      return p.slice(p.lastIndexOf("/") + 1);
    },
    resolve(...parts: string[]): string {
      return this.join(...parts);
    },
  };
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
  const p = normalizePath(folder);
  if (!(await app.vault.adapter.exists(p))) {
    await app.vault.createFolder(p);
  }
}
