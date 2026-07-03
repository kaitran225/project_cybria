import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";



const root = path.dirname(fileURLToPath(import.meta.url));

const strudel = path.join(root, "vendor", "strudel");

const coteSrc = path.join(root, "vendor", "cote-src");

const replRoot = path.join(root, "vendor", "repl");

const sep = path.sep;



const PACKAGE_DIRS = {

  superdough: "superdough",

  supradough: "supradough",

  "vite-plugin-bundle-audioworklet": "vite-plugin-bundle-audioworklet",

};



function resolveWithExtensions(basePath) {

  const candidates = [

    basePath,

    `${basePath}.mjs`,

    `${basePath}.js`,

    `${basePath}.jsx`,

    `${basePath}.ts`,

    `${basePath}.tsx`,

    path.join(basePath, "index.mjs"),

    path.join(basePath, "index.js"),

  ];

  for (const candidate of candidates) {

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  }

  return null;

}



function readPackageMain(pkgDir) {

  const pkgJsonPath = path.join(pkgDir, "package.json");

  if (!fs.existsSync(pkgJsonPath)) return null;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

  const main = pkg.main || pkg.module;

  if (!main) return null;

  return path.join(pkgDir, main);

}



function resolveStrudelFile(spec) {

  const [pkgName, ...subpathParts] = spec.split("/");

  const folder = PACKAGE_DIRS[pkgName] ?? pkgName;

  const pkgDir = path.join(strudel, folder);

  if (!fs.existsSync(pkgDir)) return null;



  if (subpathParts.length === 0) {

    return readPackageMain(pkgDir);

  }



  const subpath = subpathParts.join("/");

  const candidates = [

    path.join(pkgDir, subpath),

    path.join(pkgDir, `${subpath}.mjs`),

    path.join(pkgDir, `${subpath}.js`),

    path.join(pkgDir, subpath, "index.mjs"),

  ];

  for (const candidate of candidates) {

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  }

  return null;

}



function resolveAtSrc(subpath) {

  const normalized = subpath.replace(/\\/g, "/");

  if (normalized.startsWith("repl/")) {

    return resolveWithExtensions(path.join(replRoot, normalized.slice("repl/".length)));

  }

  const fromCote = resolveWithExtensions(path.join(coteSrc, normalized));

  if (fromCote) return fromCote;

  return resolveWithExtensions(path.join(replRoot, normalized));

}



function resolveReplParentImport(importer, importPath) {

  if (!importer.includes(`${sep}repl${sep}`) || !importPath.includes("..")) return null;



  const resolved = path.normalize(path.join(path.dirname(importer), importPath));

  if (fs.existsSync(resolved)) return null;



  const base = path.basename(resolved);

  const byBase = resolveWithExtensions(path.join(coteSrc, base));

  if (byBase) return byBase;



  const rel = importPath.replace(/^(\.\.\/)+/, "");

  return resolveWithExtensions(path.join(coteSrc, rel));

}



export function coteAliasPlugin() {

  return {

    name: "cote-strudel-alias",

    setup(build) {

      build.onResolve({ filter: /^@strudel\// }, (args) => {

        const resolved = resolveStrudelFile(args.path.slice("@strudel/".length));

        if (resolved) return { path: resolved };

        return null;

      });



      build.onResolve({ filter: /^superdough(\/|$)/ }, (args) => {

        const sub =

          args.path === "superdough" ? "superdough" : `superdough/${args.path.slice("superdough/".length)}`;

        const resolved = resolveStrudelFile(sub);

        if (resolved) return { path: resolved };

        return null;

      });



      build.onResolve({ filter: /^supradough(\/|$)/ }, (args) => {

        const sub =

          args.path === "supradough" ? "supradough" : `supradough/${args.path.slice("supradough/".length)}`;

        const resolved = resolveStrudelFile(sub);

        if (resolved) return { path: resolved };

        return null;

      });



      build.onResolve({ filter: /^@src\// }, (args) => {

        const resolved = resolveAtSrc(args.path.slice("@src/".length));

        if (resolved) return { path: resolved };

        return null;

      });



      build.onResolve({ filter: /^@kvi\/shell$/ }, () => ({

        path: path.join(root, "src", "shims", "kvi-shell.tsx"),

      }));



      build.onResolve({ filter: /^@tauri-apps\/api\/core$/ }, () => ({

        path: path.join(root, "src", "shims", "tauri-core.mjs"),

      }));



      build.onResolve({ filter: /^@tauri-apps\/plugin-clipboard-manager$/ }, () => ({
        path: path.join(root, "src", "shims", "tauri-clipboard.mjs"),
      }));

      build.onResolve({ filter: /^@tauri-apps\/api\/event$/ }, () => ({
        path: path.join(root, "src", "shims", "tauri-event.mjs"),
      }));

      build.onResolve({ filter: /^react-router-dom$/ }, () => ({
        path: path.join(root, "src", "shims", "react-router-dom.tsx"),
      }));

      build.onResolve({ filter: /\?raw$/ }, (args) => ({
        path: args.path,
        namespace: "raw-text",
      }));

      build.onLoad({ filter: /.*/, namespace: "raw-text" }, () => ({
        contents: 'export default "";',
        loader: "js",
      }));



      build.onResolve({ filter: /doc\.json$/ }, (args) => {

        if (args.path.endsWith("doc.json")) {

          return { path: path.join(root, "src", "shims", "doc.json") };

        }

        return null;

      });



      build.onResolve({ filter: /.*/ }, (args) => {

        if (args.namespace === "audioworklet") return null;



        if (args.importer?.includes(`${sep}cote-src${sep}`) && args.path.startsWith("./repl/")) {

          const resolved = resolveWithExtensions(path.join(replRoot, args.path.slice("./repl/".length)));

          if (resolved) return { path: resolved };

        }



        const parent = resolveReplParentImport(args.importer ?? "", args.path);

        if (parent) return { path: parent };



        return null;

      });

    },

  };

}

