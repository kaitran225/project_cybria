import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "node:module";
import { pixodeAliasPlugin } from "./pixode-aliases.mjs";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  plugins: [pixodeAliasPlugin()],
  external: [
    "obsidian",
    "electron",
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  jsx: "automatic",
  loader: {
    ".css": "css",
    ".json": "json",
  },
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
