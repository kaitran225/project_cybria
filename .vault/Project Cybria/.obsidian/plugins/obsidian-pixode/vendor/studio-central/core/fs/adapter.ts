export interface FileStat {
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileSystemAdapter {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat | null>;
  listDir(path: string): Promise<string[]>;
  join(...parts: string[]): string;
  basename(path: string): string;
  resolve(...parts: string[]): string;
}
