/**
 * KVI Studio project patterns — `.strudel` files under `{project}/patterns/`.
 */
import { patternFilterName, setActivePattern, setLatestCode, setViewingPatternData, userPattern } from './user_pattern_utils.mjs';
import { settingsMap } from './settings.mjs';

let projectRoot = null;
/** @type {import('./project-patterns.mjs').VaultPatternFs | null} */
let vaultFs = null;

/** @typedef {{ readText: (path: string) => Promise<string>, writeText: (path: string, content: string) => Promise<void>, exists: (path: string) => Promise<boolean>, listDir: (path: string) => Promise<string[]>, mkdir: (path: string) => Promise<void>, remove: (path: string) => Promise<void> }} VaultPatternFs */

export function setVaultPatternFs(fs) {
  vaultFs = fs;
}

function useVaultFs() {
  return vaultFs != null;
}

function join(...parts) {
  let result = '';
  for (const part of parts) {
    if (!part) continue;
    const p = String(part).replace(/\\/g, '/');
    const absolute = /^[A-Za-z]:\//.test(p) || p.startsWith('/');
    if (absolute) {
      result = p;
    } else if (!result) {
      result = p;
    } else {
      result = `${result.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
    }
  }
  return result.replace(/\/+/g, '/');
}

function basename(filePath, ext) {
  const p = filePath.replace(/\\/g, '/');
  const name = p.slice(p.lastIndexOf('/') + 1);
  if (ext && name.endsWith(ext)) {
    return name.slice(0, -ext.length);
  }
  return name;
}

export function slugifyPatternName(name) {
  const slug = String(name)
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

export function getProjectPatternsRoot() {
  return projectRoot;
}

export function isStudioProjectPatterns() {
  return Boolean(projectRoot);
}

export function setProjectPatternsRoot(root) {
  projectRoot = root?.replace(/\\/g, '/').replace(/\/$/, '') || null;
}

async function tauriInvoke(cmd, args = {}) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
}

async function readText(path) {
  if (vaultFs) return vaultFs.readText(path);
  return tauriInvoke('fs_read_text', { path });
}

async function writeText(path, content) {
  if (vaultFs) return vaultFs.writeText(path, content);
  return tauriInvoke('fs_write_text', { path, content });
}

async function exists(path) {
  if (vaultFs) return vaultFs.exists(path);
  return tauriInvoke('fs_exists', { path });
}

async function listDir(path) {
  if (vaultFs) return vaultFs.listDir(path);
  return tauriInvoke('fs_list_dir', { path });
}

async function mkdir(path) {
  if (vaultFs) return vaultFs.mkdir(path);
  return tauriInvoke('fs_mkdir', { path });
}

async function remove(path) {
  if (vaultFs) return vaultFs.remove(path);
  return tauriInvoke('fs_remove', { path });
}

function patternsDir() {
  if (useVaultFs()) return projectRoot;
  return join(projectRoot, 'patterns');
}

function patternFilePath(id) {
  return join(patternsDir(), `${id}.strudel`);
}

function setUserPatterns(obj) {
  settingsMap.setKey('userPatterns', JSON.stringify(obj));
}

export async function persistPatternFile(id, code) {
  if (!projectRoot) {
    throw new Error('No Cote Studio project is open');
  }
  if (!id) {
    throw new Error('Pattern name is required');
  }
  const path = patternFilePath(id);
  const dir = patternsDir();
  if (!(await exists(dir))) {
    await mkdir(dir);
  }
  await writeText(path, code ?? '');
  return { path, id };
}

export async function deletePatternFile(id) {
  if (!projectRoot || !id) return;
  const path = patternFilePath(id);
  if (await exists(path)) {
    await remove(path);
  }
}

export async function loadProjectPatternsFromDisk(root = projectRoot) {
  if (!root) return {};
  setProjectPatternsRoot(root);
  const dir = patternsDir();
  if (!(await exists(dir))) {
    await mkdir(dir);
    setUserPatterns({});
    const { initPatternSaveBaseline } = await import('./pattern-save.mjs');
    initPatternSaveBaseline({});
    return {};
  }

  const entries = await listDir(dir);
  const patterns = {};
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.strudel')) continue;
    const id = basename(entry, '.strudel');
    const rel = `patterns/${entry}`;
    const full = join(dir, entry);
    try {
      const code = await readText(full);
      patterns[id] = {
        id,
        code,
        collection: patternFilterName.user,
        created_at: Date.now(),
        file: rel,
      };
    } catch (err) {
      console.warn(`[cote] failed to load pattern ${entry}`, err);
    }
  }
  setUserPatterns(patterns);
  const { initPatternSaveBaseline } = await import('./pattern-save.mjs');
  initPatternSaveBaseline(patterns);
  return patterns;
}

export async function loadDefaultProjectPattern(root = projectRoot) {
  if (!root) return null;
  if (useVaultFs()) {
    const patterns = userPattern.getAll();
    const pick = Object.values(patterns)[0];
    if (!pick) return null;
    setViewingPatternData(pick);
    setLatestCode(pick.code);
    setActivePattern(pick.id);
    return pick;
  }
  let defaultRel = 'patterns/Welcome.strudel';
  try {
    const raw = await readText(join(root, 'cote.project.json'));
    const manifest = JSON.parse(raw);
    if (typeof manifest.defaultPattern === 'string' && manifest.defaultPattern.trim()) {
      defaultRel = manifest.defaultPattern.trim();
    }
  } catch {
    /* use welcome default */
  }

  const patterns = userPattern.getAll();
  const defaultId = basename(defaultRel, '.strudel');
  const pick = patterns[defaultId] ?? Object.values(patterns)[0];
  if (!pick) return null;

  setViewingPatternData(pick);
  setLatestCode(pick.code);
  setActivePattern(pick.id);
  return pick;
}

/** Open a project pattern by relative path (e.g. `patterns/Welcome.strudel`). */
export function openProjectPatternByFile(relPath) {
  if (!relPath?.trim()) return null;
  const normalized = relPath.trim().replace(/\\/g, '/');
  const patterns = userPattern.getAll();
  const byFile = Object.values(patterns).find(
    (p) => p.file === normalized || p.file === normalized.replace(/^\//, ''),
  );
  const byId = patterns[basename(normalized, '.strudel')];
  const pick = byFile ?? byId;
  if (!pick) return null;

  setViewingPatternData(pick);
  setLatestCode(pick.code);
  setActivePattern(pick.id);
  return pick;
}

export function promptPatternName(defaultName = 'untitled') {
  const raw = window.prompt('Pattern name', defaultName);
  if (raw == null) return null;
  return slugifyPatternName(raw);
}
