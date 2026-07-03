import esbuild from "esbuild";

import process from "process";

import { builtinModules } from "node:module";

import { coteAliasPlugin } from "./cote-aliases.mjs";

import { audioworkletPlugin } from "./audioworklet-plugin.mjs";



const prod = process.argv[2] === "production";

const aliasPlugin = coteAliasPlugin();



const shared = {

  bundle: true,

  external: [

    "obsidian",

    "electron",

    ...builtinModules,

    ...builtinModules.map((m) => `node:${m}`),

  ],

  format: "cjs",

  target: "es2020",
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  jsx: "automatic",

  loader: {

    ".css": "css",

    ".jsx": "jsx",

    ".mjs": "js",

    ".json": "json",

  },

  plugins: [aliasPlugin, audioworkletPlugin([aliasPlugin])],

  logLevel: "info",

  sourcemap: prod ? false : "inline",

  minify: prod,

};



const context = await esbuild.context({

  ...shared,

  entryPoints: ["src/main.tsx", "src/repl-chunk.tsx"],

  outdir: ".",

});



if (prod) {

  await context.rebuild();

  process.exit(0);

} else {

  await context.watch();

}

