import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.join(root, "vendor");

function resolveWithJs(basePath) {
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    `${basePath}.js`,
    path.join(basePath, "index.js"),
    basePath,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return basePath;
}

function resolvePixode(specifier) {
  if (specifier === "@pixode/asset-core") {
    return path.join(vendor, "asset-core/index.ts");
  }
  if (specifier.startsWith("@pixode/asset-core/")) {
    const sub = specifier.slice("@pixode/asset-core/".length);
    return resolveWithJs(path.join(vendor, "asset-core", sub));
  }
  if (specifier === "@pixode/design") {
    return path.join(vendor, "design/src/index.ts");
  }
  if (specifier.startsWith("@pixode/design/")) {
    const sub = specifier.slice("@pixode/design/".length);
    if (sub.startsWith("fixtures/")) {
      return path.join(vendor, "design", sub);
    }
    return resolveWithJs(path.join(vendor, "design/src", sub));
  }
  if (specifier === "@pixode/quality") {
    return path.join(vendor, "quality/index.ts");
  }
  if (specifier.startsWith("@pixode/quality/")) {
    return resolveWithJs(path.join(vendor, "quality", specifier.slice("@pixode/quality/".length)));
  }
  if (specifier === "@pixode/studio-central/canvas/index.js") {
    return path.join(vendor, "studio-central/canvas/index.ts");
  }
  if (specifier.startsWith("@pixode/studio-central/")) {
    const sub = specifier.slice("@pixode/studio-central/".length).replace(/\.js$/, "");
    return resolveWithJs(path.join(vendor, "studio-central", sub));
  }
  if (specifier === "@pixode/studio-central") {
    return path.join(vendor, "studio-central/index.ts");
  }
  return null;
}

export function pixodeAliasPlugin() {
  return {
    name: "pixode-alias",
    setup(build) {
      build.onResolve({ filter: /^@pixode\// }, (args) => {
        const resolved = resolvePixode(args.path);
        if (resolved) return { path: resolved };
        return null;
      });
      build.onResolve({ filter: /\.json$/ }, (args) => {
        if (fs.existsSync(args.path)) return { path: args.path };
        return null;
      });
    },
  };
}
