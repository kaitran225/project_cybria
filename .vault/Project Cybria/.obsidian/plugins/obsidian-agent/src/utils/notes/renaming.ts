import { getApp } from "src/plugin";

// Builds the full vault path for `name` inside `parentPath`, treating the
// vault root ('' or '/') as having no path prefix.
function constructPath(parentPath: string, name: string): string {
    if (parentPath === '/' || parentPath === '') return name;
    return `${parentPath.replace(/\/$/, '')}/${name}`;
}

// Appends a numbered suffix " (n)" to `baseName` until an unused name is found
// inside `parentPath`. `ext` (e.g. ".md") is kept at the end of file names;
// folders pass an empty string. Reuses and continues an existing numbered
// suffix like " (1)", " (2)", etc. instead of stacking a new one.
function nextAvailableName(baseName: string, ext: string, parentPath: string): string {
    const app = getApp();

    const numberedSuffixMatch = baseName.match(/^(.+) \((\d+)\)$/);
    const root = numberedSuffixMatch ? numberedSuffixMatch[1] : baseName;
    const startingNumber = numberedSuffixMatch ? parseInt(numberedSuffixMatch[2]) + 1 : 1;

    // The original name is available, use it as-is
    const original = `${root}${ext}`;
    if (!app.vault.getAbstractFileByPath(constructPath(parentPath, original))) {
        return original;
    }

    // Otherwise keep incrementing the suffix until a free name is found
    for (let i = startingNumber; ; i++) {
        const candidate = `${root} (${i})${ext}`;
        if (!app.vault.getAbstractFileByPath(constructPath(parentPath, candidate))) {
            return candidate;
        }
    }
}

// Append a number to a file name if it already exists, keeping its extension
export function getNextAvailableFileName(base: string, parentPath: string): string {
    const extMatch = base.match(/\.[^/.]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const baseName = ext ? base.slice(0, -ext.length) : base;

    return nextAvailableName(baseName, ext, parentPath);
}

// Append a number to a folder name if it already exists
export function getNextAvailableFolderName(base: string, parentPath: string): string {
    return nextAvailableName(base, '', parentPath);
}
