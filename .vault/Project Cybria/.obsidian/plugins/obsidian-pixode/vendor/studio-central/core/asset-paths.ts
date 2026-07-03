import type { AssetCategory } from "@pixode/design";

export function assetFolderForCategory(category: string): string {
  switch (category) {
    case "enemy":
      return "enemies";
    case "character":
      return "characters";
    case "item":
      return "items";
    case "tileset":
      return "tilesets";
    case "ui_icon":
      return "ui";
    default:
      return "misc";
  }
}

export function assetRelPath(category: string, assetId: string): string {
  const fileName = `${assetId.replace(/_/g, "-")}.pixelasset.json`;
  return `assets/${assetFolderForCategory(category)}/${fileName}`;
}

export function slugifyAssetId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "asset";
}

export function canvasTypeForCategory(
  category: AssetCategory
): "sprite" | "tileset" | "icon" {
  if (category === "tileset") return "tileset";
  if (category === "ui_icon") return "icon";
  return "sprite";
}
