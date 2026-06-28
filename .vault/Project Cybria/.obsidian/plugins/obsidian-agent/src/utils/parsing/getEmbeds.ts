import { TFile } from "obsidian";
import { getApp } from "src/plugin";


// Return File objects for every embedded image in a note.
// Uses the Vault API (readBinary) so it works on every platform and never
// touches the filesystem outside of the vault.
export async function getEmbeds(file: TFile): Promise<File[]> {
  if (file.extension !== "md") return [];

  const app = getApp();
  const meta = app.metadataCache.getFileCache(file);
  const embeddedFiles = meta?.embeds?.map((embed) => embed.link);

  if (embeddedFiles && embeddedFiles.length > 0) {
    const images: File[] = [];

    for (const embedFile of embeddedFiles) {
      // Ignore non-image embeds
      if (
        !embedFile.endsWith(".png") &&
        !embedFile.endsWith(".jpg") &&
        !embedFile.endsWith(".jpeg")
      ) {
        continue;
      }

      try {
        // Find referenced file in vault
        const match = app.vault
          .getFiles()
          .find((f) => f.extension !== "md" && f.name === embedFile);

        if (!match) continue;

        // Read the image through the Vault API
        const buffer = await app.vault.readBinary(match);

        // Detect MIME type
        const mimeType =
          match.extension === "png"
            ? "image/png"
            : "image/jpeg";

        const fileObj = new File([new Uint8Array(buffer)], match.name, { type: mimeType });

        images.push(fileObj);
      } catch (error) {
        console.error("Error reading embedded file:", error);
        return [];
      }
    }

    return images;
  }

  return [];
}
