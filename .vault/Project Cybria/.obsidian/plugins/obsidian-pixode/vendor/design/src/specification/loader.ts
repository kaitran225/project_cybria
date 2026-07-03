import type { AssetSpecification } from "./types.js";
import { validateSpecSchema } from "./schema.js";

export function parseSpec(json: string): AssetSpecification {
  const data = JSON.parse(json);
  const result = validateSpecSchema(data);
  if (!result.valid) {
    throw new Error(`Invalid spec: ${result.errors.map((e) => e.message).join(", ")}`);
  }
  return data as AssetSpecification;
}
