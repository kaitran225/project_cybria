import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const ASSET_ROOT = path.resolve(PKG_ROOT, '../../asset');

const MODEL_EXT = new Set(['.fbx', '.glb', '.gltf', '.vrm']);

function walkModels(dir: string, out: { name: string; url: string; kind: string }[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkModels(full, out);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!MODEL_EXT.has(ext)) continue;

    const rel = path.relative(ASSET_ROOT, full).split(path.sep).join('/');
    out.push({
      name: ent.name,
      url: `/milltina-assets/${rel}`,
      kind: ext.slice(1),
    });
  }
  return out;
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.fbx':
      return 'application/octet-stream';
    case '.glb':
      return 'model/gltf-binary';
    case '.gltf':
      return 'model/gltf+json';
    case '.vrm':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

export function milltinaAssetsPlugin(): Plugin {
  return {
    name: 'milltina-assets',
    configureServer(server) {
      server.middlewares.use('/api/local-models', (_req, res) => {
        const models = walkModels(ASSET_ROOT);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ assetRoot: ASSET_ROOT, models }));
      });

      server.middlewares.use('/milltina-assets', (req, res, next) => {
        if (!req.url) return next();
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
        const filePath = path.resolve(ASSET_ROOT, rel);
        if (!filePath.startsWith(ASSET_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', contentType(filePath));
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}
