import type { ExporterPlugin } from "./plugin.js";
import { CanonicalJsonExporter } from "./canonical-json.js";
import { ManifestExporter } from "./manifest.js";
import { TexturePackerExporter } from "./texturepacker.js";
import { PngExporter } from "./png.js";

export class ExporterRegistry {
  private plugins: Map<string, ExporterPlugin> = new Map();

  register(plugin: ExporterPlugin): void {
    this.plugins.set(plugin.target.format, plugin);
  }

  get(format: string): ExporterPlugin | undefined {
    return this.plugins.get(format);
  }

  list(): ExporterPlugin[] {
    return [...this.plugins.values()];
  }

  formats(): string[] {
    return [...this.plugins.keys()];
  }
}

export function createDefaultRegistry(): ExporterRegistry {
  const registry = new ExporterRegistry();
  registry.register(new CanonicalJsonExporter());
  registry.register(new ManifestExporter());
  registry.register(new TexturePackerExporter());
  registry.register(new PngExporter());
  return registry;
}
