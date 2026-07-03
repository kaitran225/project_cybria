import type { FileSystemAdapter, FileStat } from "./adapter.js";

export class MemoryFileSystemAdapter implements FileSystemAdapter {
  private files = new Map<string, string>();

  setFile(path: string, content: string): void {
    this.files.set(this.normalize(path), content);
  }

  private normalize(path: string): string {
    return path.replace(/\\/g, "/");
  }

  async readText(path: string): Promise<string> {
    const key = this.normalize(path);
    const content = this.files.get(key);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }

  async writeText(path: string, content: string): Promise<void> {
    this.files.set(this.normalize(path), content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(this.normalize(path));
  }

  async stat(path: string): Promise<FileStat | null> {
    const key = this.normalize(path);
    if (!this.files.has(key)) return null;
    const isDir = key.endsWith("/") || [...this.files.keys()].some(
      (k) => k.startsWith(key + "/") && k !== key
    );
    if (isDir) return { isDirectory: true, isFile: false };
    return { isDirectory: false, isFile: true };
  }

  async listDir(path: string): Promise<string[]> {
    const prefix = this.normalize(path).replace(/\/?$/, "/");
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    return [...names].filter(Boolean);
  }

  join(...parts: string[]): string {
    let result = "";
    for (const part of parts) {
      if (!part) continue;
      const p = part.replace(/\\/g, "/");
      const absolute = /^[A-Za-z]:\//.test(p) || p.startsWith("/");
      if (absolute) {
        result = p;
      } else if (!result) {
        result = p;
      } else {
        result = `${result.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;
      }
    }
    return result.replace(/\/+/g, "/");
  }

  basename(path: string): string {
    const p = this.normalize(path).replace(/\/$/, "");
    const i = p.lastIndexOf("/");
    return i === -1 ? p : p.slice(i + 1);
  }

  resolve(...parts: string[]): string {
    return this.join(...parts);
  }
}
