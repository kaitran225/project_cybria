import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const IMAGE_EXT = /\.(png|jpe?g|tga|bmp|webp)$/i;

export type FbxLoadOptions = {
  /** Base URL ending with `/` — used for texture resolution */
  resourcePath?: string;
  /** basename (lowercase) → blob/http URL */
  textureUrls?: Map<string, string>;
};

export function dirnameUrl(url: string): string {
  const q = url.indexOf('?');
  const clean = q >= 0 ? url.slice(0, q) : url;
  const slash = clean.lastIndexOf('/');
  return slash >= 0 ? clean.slice(0, slash + 1) : '';
}

/** Avoid Three.js doubling resourcePath + absolute URL on loader.load(). */
export function prepareFbxLoadUrl(
  url: string,
  resourcePath?: string,
): { loadUrl: string; textureBase: string; attachResourcePath: boolean } {
  const textureBase = resourcePath || dirnameUrl(url);

  if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return { loadUrl: url, textureBase, attachResourcePath: false };
  }

  if (textureBase && url.startsWith(textureBase)) {
    return {
      loadUrl: url.slice(textureBase.length),
      textureBase,
      attachResourcePath: true,
    };
  }

  if (url.startsWith('/')) {
    return { loadUrl: url, textureBase, attachResourcePath: false };
  }

  return { loadUrl: url, textureBase, attachResourcePath: Boolean(textureBase) };
}

export function buildTextureUrlMap(files: Iterable<File>): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    if (!IMAGE_EXT.test(file.name)) continue;
    const blobUrl = URL.createObjectURL(file);
    const base = file.name.toLowerCase();
    const leaf = base.split(/[/\\]/).pop()!;
    map.set(base, blobUrl);
    map.set(leaf, blobUrl);
    const parts = base.split(/[/\\]/);
    if (parts.length >= 2) {
      map.set(parts.slice(-2).join('/'), blobUrl);
    }
  }
  return map;
}

function dedupeAssetUrl(url: string): string {
  const normalized = url.replace(/\\/g, '/');
  const marker = '/milltina-assets/';
  const second = normalized.indexOf(marker, marker.length);
  if (second > 0) return normalized.slice(second);
  return normalized;
}

export function createFbxLoader(
  textureBase: string,
  options: Pick<FbxLoadOptions, 'textureUrls'> & { attachResourcePath: boolean },
): FBXLoader {
  const { textureUrls, attachResourcePath } = options;
  const manager = new THREE.LoadingManager();

  manager.setURLModifier((url) => {
    let normalized = url.replace(/\\/g, '/');
    normalized = dedupeAssetUrl(normalized);

    if (/^(https?:|blob:|data:)/i.test(normalized)) return normalized;
    if (normalized.startsWith('/')) return normalized;

    const leaf = normalized.split('/').pop()?.toLowerCase() ?? '';
    if (textureUrls?.has(leaf)) return textureUrls.get(leaf)!;
    if (textureUrls) {
      for (const [key, blobUrl] of textureUrls) {
        if (key.endsWith(leaf) || leaf.endsWith(key)) return blobUrl;
      }
    }

    if (textureBase) {
      const rel = normalized.replace(/^\.\//, '');
      if (rel.startsWith('/')) return rel;
      return textureBase + rel;
    }

    return normalized;
  });

  const loader = new FBXLoader(manager);
  if (attachResourcePath && textureBase) {
    loader.setResourcePath(textureBase);
  }
  return loader;
}

export function revokeTextureUrls(map?: Map<string, string>) {
  if (!map) return;
  const seen = new Set<string>();
  for (const url of map.values()) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
}

export type TextureAudit = {
  materials: number;
  withColorMap: number;
  missingColorMap: number;
};

export function auditTextures(root: THREE.Object3D): TextureAudit {
  let materials = 0;
  let withColorMap = 0;
  let missingColorMap = 0;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.SkinnedMesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      materials++;
      const m = mat as THREE.MeshPhongMaterial & { map?: THREE.Texture };
      if (m.map) withColorMap++;
      else missingColorMap++;
    }
  });

  return { materials, withColorMap, missingColorMap };
}
