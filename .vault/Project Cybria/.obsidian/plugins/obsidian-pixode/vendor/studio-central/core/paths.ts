export function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

export function isAbsolutePath(path: string): boolean {
  const p = normalizeSlashes(path);
  return /^[A-Za-z]:\//.test(p) || p.startsWith("/");
}

/** Strip project root from a path when present; otherwise return a clean relative path. */
export function toRelativePath(rootPath: string, filePath: string): string {
  const root = normalizeSlashes(rootPath).replace(/\/$/, "");
  const p = normalizeSlashes(filePath);
  if (!isAbsolutePath(p)) {
    return p.replace(/^\//, "");
  }
  const rootLower = root.toLowerCase();
  const pLower = p.toLowerCase();
  if (pLower === rootLower) return "";
  if (pLower.startsWith(`${rootLower}/`)) {
    return p.slice(root.length).replace(/^\//, "");
  }
  return p.replace(/^\//, "");
}

/** Resolve a project-relative or absolute-under-root path to a full path under root. */
export function resolveUnderRoot(rootPath: string, path: string): string {
  const root = normalizeSlashes(rootPath).replace(/\/$/, "");
  const p = normalizeSlashes(path);
  if (isAbsolutePath(p)) {
    const rel = toRelativePath(root, p);
    if (
      p.toLowerCase() === root.toLowerCase() ||
      p.toLowerCase().startsWith(`${root.toLowerCase()}/`)
    ) {
      return rel ? `${root}/${rel}` : root;
    }
    return p;
  }
  return `${root}/${p.replace(/^\//, "")}`;
}
