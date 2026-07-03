import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const AUDIOWORKLET = /\?audioworklet$/;

export function audioworkletPlugin(extraPlugins = []) {
  return {
    name: "bundle-audioworklet",
    setup(build) {
      build.onResolve({ filter: AUDIOWORKLET }, (args) => {
        const file = args.path.replace("?audioworklet", "");
        const resolved = path.isAbsolute(file)
          ? file
          : path.normalize(path.join(path.dirname(args.importer), file));
        if (!fs.existsSync(resolved)) {
          return { errors: [{ text: `audioworklet entry not found: ${resolved}` }] };
        }
        return { path: resolved, namespace: "audioworklet" };
      });

      build.onLoad({ filter: /.*/, namespace: "audioworklet" }, async (args) => {
        const result = await esbuild.build({
          entryPoints: [args.path],
          bundle: true,
          write: false,
          format: "iife",
          platform: "browser",
          target: "es2020",
          plugins: extraPlugins,
          loader: { ".mjs": "js", ".js": "js" },
        });
        const iife = result.outputFiles[0].text;
        const encoded = Buffer.from(iife, "utf8").toString("base64");
        return {
          contents: `export default "data:text/javascript;base64,${encoded}";`,
          loader: "js",
        };
      });
    },
  };
}
