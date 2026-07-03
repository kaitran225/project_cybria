import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getSchemaJSON } from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../schemas/pixel-asset.schema.json");
writeFileSync(outPath, getSchemaJSON());
console.log(`Schema written to ${outPath}`);
