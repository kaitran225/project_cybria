import type { AssetSpecification } from "@pixode/design";
import type { ProjectBrain } from "@pixode/asset-core/project";

export interface ParseIntentOptions {
  intent: string;
  defaultStyleId: string;
  brain?: ProjectBrain;
  count?: number;
}

/**
 * Deterministic NL parser for batch spec generation (no LLM required).
 * Extracts count, theme, species, and category from designer intent text.
 */
export function parseIntentToSpecs(
  options: ParseIntentOptions
): AssetSpecification[] {
  const { intent, defaultStyleId, brain, count: explicitCount } = options;
  const lower = intent.toLowerCase();

  const countMatch = lower.match(/(\d+)\s+/);
  const count = explicitCount ?? (countMatch ? parseInt(countMatch[1], 10) : 1);

  const themes = brain ? Object.keys(brain.biomePalettes ?? {}) : ["forest", "cave", "desert"];
  const theme = themes.find((t) => lower.includes(t)) ?? themes[0];

  const speciesList = brain?.races.map((r) => r.id) ?? ["slime", "goblin", "skeleton"];
  const species = speciesList.find((s) => lower.includes(s)) ?? speciesList[0];

  let category: AssetSpecification["category"] = "enemy";
  if (lower.includes("character") || lower.includes("hero")) category = "character";
  else if (lower.includes("item")) category = "item";
  else if (lower.includes("tileset") || lower.includes("tile")) category = "tileset";
  else if (lower.includes("icon") || lower.includes("ui")) category = "ui_icon";

  const specs: AssetSpecification[] = [];
  for (let i = 0; i < count; i++) {
    const suffix = count > 1 ? `_${i + 1}` : "";
    specs.push({
      id: `${theme}_${species}${suffix}`,
      version: "1.0.0",
      category,
      theme,
      species,
      size: "small",
      styleId: defaultStyleId,
      blueprintId: species,
      animations: category === "enemy" || category === "character" ? ["idle"] : [],
      tags: [category, species, theme],
    });
  }
  return specs;
}

