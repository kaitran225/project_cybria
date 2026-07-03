import type { FileSystemAdapter } from "./fs/adapter.js";
import retroRpgStyle from "../../design/fixtures/retro-rpg.pixelstyle.json";

export interface ScaffoldProjectOptions {
  id: string;
  name: string;
}

export function slugifyProjectId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "project";
}

function projectManifest(options: ScaffoldProjectOptions): string {
  return (
    JSON.stringify(
      {
        id: options.id,
        name: options.name,
        version: "1.0.0",
        brainPath: "brain",
        defaultStyleId: "retro_rpg",
        assetCatalog: [],
      },
      null,
      2
    ) + "\n"
  );
}

function projectBrain(options: ScaffoldProjectOptions): string {
  return (
    JSON.stringify(
      {
        id: options.id,
        version: "1.0.0",
        lore: [],
        factions: [{ id: "nature", name: "Nature Spirits", tags: ["forest"] }],
        races: [{ id: "slime", name: "Slime", factionId: "nature" }],
        visualLanguage: {
          outlineRequired: true,
          maxColorsPerAsset: 12,
          silhouetteRules: ["readable at 16x16", "clear outline"],
        },
        artRules: [
          {
            id: "outline_rule",
            rule: "All sprites must have 1px outline",
            severity: "error",
          },
        ],
        naming: {
          assetIdPattern: "{theme}_{species}",
          tagPrefixes: { enemy: "enm", npc: "npc" },
        },
        biomePalettes: {
          forest: [
            { id: 0, hex: "#1a1c2c", role: "outline" },
            { id: 1, hex: "#38b764", role: "fill" },
            { id: 2, hex: "#a7f070", role: "highlight" },
          ],
        },
      },
      null,
      2
    ) + "\n"
  );
}

const RETRO_RPG_STYLE = `${JSON.stringify(retroRpgStyle, null, 2)}\n`;

const SLIME_BLUEPRINT = `{
  "id": "slime",
  "version": "1.0.0",
  "name": "Slime",
  "category": "enemy",
  "canvas": { "width": 16, "height": 16 },
  "layers": [
    { "id": "body", "role": "body", "required": true, "zOrder": 0 },
    { "id": "eyes", "role": "detail", "required": false, "zOrder": 1 },
    { "id": "outline", "role": "outline", "required": true, "zOrder": 2 }
  ],
  "regions": [
    { "id": "body", "role": "torso", "required": true, "boundsHint": { "x": 4, "y": 5, "w": 8, "h": 8 } },
    { "id": "eyes", "role": "head", "required": false, "boundsHint": { "x": 6, "y": 7, "w": 4, "h": 2 } }
  ],
  "animations": [{ "id": "idle", "required": true, "minFrames": 1, "maxFrames": 4, "loop": true }],
  "paletteSlots": [
    { "role": "outline", "required": true },
    { "role": "fill", "required": true },
    { "role": "highlight", "required": false },
    { "role": "eye", "required": false }
  ],
  "symmetry": "horizontal",
  "generationHints": { "shape": "blob", "anchorY": 12 }
}
`;

export async function scaffoldProject(
  fs: FileSystemAdapter,
  rootPath: string,
  options: ScaffoldProjectOptions
): Promise<void> {
  const files: Array<[string, string]> = [
    [fs.join(rootPath, "pixode.project.json"), projectManifest(options)],
    [fs.join(rootPath, "brain", "project-brain.json"), projectBrain(options)],
    [fs.join(rootPath, "styles", "retro-rpg.pixelstyle.json"), RETRO_RPG_STYLE],
    [fs.join(rootPath, "blueprints", "slime.blueprint.json"), SLIME_BLUEPRINT],
    [fs.join(rootPath, "assets", ".gitkeep"), ""],
    [fs.join(rootPath, "specs", ".gitkeep"), ""],
  ];

  for (const [path, content] of files) {
    await fs.writeText(path, content);
  }
}
