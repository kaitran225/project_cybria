import { normalizePath, type App, type TFile } from "obsidian";

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/").replace(/\\/g, "/"));
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
  const p = normalizePath(folder);
  if (!(await app.vault.adapter.exists(p))) {
    await app.vault.createFolder(p);
  }
}

export async function listPatternFiles(app: App, folder: string): Promise<TFile[]> {
  const p = normalizePath(folder);
  if (!(await app.vault.adapter.exists(p))) return [];
  const files = app.vault.getFiles().filter((f) => f.path.startsWith(p) && f.extension === "strudel");
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readPattern(app: App, file: TFile): Promise<string> {
  return app.vault.read(file);
}

export async function writePattern(app: App, file: TFile, content: string): Promise<void> {
  await app.vault.modify(file, content);
}

export async function createPattern(
  app: App,
  folder: string,
  name: string,
  content: string
): Promise<TFile> {
  await ensureFolder(app, folder);
  const base = name.replace(/\.strudel$/i, "").replace(/[/\\:*?"<>|]/g, "-").trim() || "untitled";
  let path = joinPath(folder, `${base}.strudel`);
  let n = 1;
  while (await app.vault.adapter.exists(path)) {
    path = joinPath(folder, `${base}-${n}.strudel`);
    n++;
  }
  return app.vault.create(path, content);
}
