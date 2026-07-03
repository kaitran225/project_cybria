import type { AssetSpecification } from "@pixode/design";
import type { StudioCategory, StudioSpecForm } from "./types.js";

export function displayName(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapCategoryFilter(category?: StudioCategory): string | undefined {
  if (!category || category === "all") return undefined;
  const map: Record<string, string> = {
    character: "character",
    enemy: "enemy",
    item: "item",
    tileset: "tileset",
    ui: "ui_icon",
  };
  return map[category];
}

export function specFormToSpec(form: StudioSpecForm): AssetSpecification {
  return {
    id: form.id,
    version: "1.0.0",
    category: form.type,
    theme: form.theme,
    species: form.species,
    size: form.size,
    styleId: form.styleId,
    blueprintId: form.blueprintId,
    animations: form.animations,
    tags: [form.type, form.species, form.theme].filter(Boolean) as string[],
    constraints: form.outline ? { outline: true } : undefined,
    metadata: form.paletteTheme ? { notes: `Palette theme: ${form.paletteTheme}` } : undefined,
  };
}

export function specToForm(spec: AssetSpecification): StudioSpecForm {
  return {
    id: spec.id,
    type: spec.category,
    species: spec.species,
    theme: spec.theme,
    size: spec.size,
    styleId: spec.styleId,
    blueprintId: spec.blueprintId,
    outline: spec.constraints?.outline === true,
    paletteTheme: spec.metadata?.notes?.replace("Palette theme: ", ""),
    animations: spec.animations ?? [],
  };
}
