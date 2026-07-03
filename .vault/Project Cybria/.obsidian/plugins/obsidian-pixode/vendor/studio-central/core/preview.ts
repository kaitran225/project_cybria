import { compileToRaster } from "@pixode/design/compiler";
import { encodePNG } from "@pixode/asset-core/exporters";
import type { PixelAssetDocument } from "@pixode/asset-core";

function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export function renderPreview(doc: PixelAssetDocument): string {
  const compiled = compileToRaster(doc);
  const grid = compiled.frames[0]?.grid;
  if (!grid) throw new Error(`Asset "${doc.id}" has no compiled frames`);
  const png = encodePNG(grid);
  return `data:image/png;base64,${uint8ToBase64(png)}`;
}
