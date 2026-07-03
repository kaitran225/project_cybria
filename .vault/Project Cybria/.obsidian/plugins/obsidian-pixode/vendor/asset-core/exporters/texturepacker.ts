import type { PixelAssetDocument } from "../types.js";
import type { CompileResult } from "../types.js";
import type { ExporterPlugin, ExportOutput, ExportTarget } from "./plugin.js";

interface TexturePackerFrame {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
}

interface TexturePackerMeta {
  app: string;
  version: string;
  image: string;
  format: string;
  size: { w: number; h: number };
  scale: string;
  frameTags: Array<{
    name: string;
    from: number;
    to: number;
    direction: string;
  }>;
}

interface TexturePackerJson {
  frames: TexturePackerFrame[];
  meta: TexturePackerMeta;
}

export class TexturePackerExporter implements ExporterPlugin {
  readonly target: ExportTarget = {
    format: "texturepacker",
    label: "TexturePacker JSON",
  };

  canExport(): boolean {
    return true;
  }

  export(doc: PixelAssetDocument, compiled: CompileResult): ExportOutput[] {
    const { width, height } = doc.canvas;
    const frameCount = compiled.frames.length;

    const sheetWidth = width * frameCount;
    const sheetHeight = height;

    const tpFrames: TexturePackerFrame[] = compiled.frames.map((f, i) => ({
      filename: `${doc.id}_${i}.png`,
      frame: { x: i * width, y: 0, w: width, h: height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: width, h: height },
      sourceSize: { w: width, h: height },
      duration: f.duration,
    }));

    const animStates = doc.animations?.states ?? [];
    let frameOffset = 0;
    const frameTags = animStates.map((state) => {
      const from = frameOffset;
      const to = frameOffset + state.frames.length - 1;
      frameOffset += state.frames.length;
      return {
        name: state.id,
        from,
        to,
        direction: "forward",
      };
    });

    const output: TexturePackerJson = {
      frames: tpFrames,
      meta: {
        app: "pixode-tool",
        version: "0.1.0",
        image: `${doc.id}.png`,
        format: "RGBA8888",
        size: { w: sheetWidth, h: sheetHeight },
        scale: "1",
        frameTags,
      },
    };

    return [
      {
        filename: `${doc.id}.texturepacker.json`,
        contentType: "application/json",
        data: JSON.stringify(output, null, 2) + "\n",
      },
    ];
  }
}
