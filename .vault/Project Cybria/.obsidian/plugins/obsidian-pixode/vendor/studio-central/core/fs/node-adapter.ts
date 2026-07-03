import { readFile, writeFile, stat, readdir, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, basename, resolve, dirname } from "path";
import type { FileSystemAdapter, FileStat } from "./adapter.js";

export class NodeFileSystemAdapter implements FileSystemAdapter {
  async readText(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async writeText(path: string, content: string): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async stat(path: string): Promise<FileStat | null> {
    try {
      const s = await stat(path);
      return { isDirectory: s.isDirectory(), isFile: s.isFile() };
    } catch {
      return null;
    }
  }

  async listDir(path: string): Promise<string[]> {
    try {
      return await readdir(path);
    } catch {
      return [];
    }
  }

  join(...parts: string[]): string {
    return join(...parts);
  }

  basename(path: string): string {
    return basename(path);
  }

  resolve(...parts: string[]): string {
    return resolve(...parts);
  }
}
