import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { findClosestFile, findMatchingFolder } from "src/utils/notes/searching";


export const vaultSearchTool = tool(
  async ({ name, isNote }) => vaultSearch(name, isNote),
  {
    name: "vault_search",
    description: "Searches for notes and folders in Obsidian's user vault.",
    schema: z.object({
      name: z.string().describe("The path or name to search for."),
      isNote: z.boolean().optional().describe("Whether is a note (True) or a folder (False)"),
    }),
  }
);

// Search notes or folders in the vault with their name or path
export async function vaultSearch(
  name: string, 
  isNote = true,
) {
  if (isNote) {
    // Search for the note
    const matchedFile = findClosestFile(name);
    if (!matchedFile) {
      const errorMsg = `Could not find any note with the exact name or similar to "${name}".`;
      return { success: false, response: errorMsg };
    }

    // Return the note path
    return {
      success: true,
      response: { 
        type: "note",
        path: matchedFile.path,
      },
    };
  } else {
    // Search for the directory
    const matchedFolder = findMatchingFolder(name);
    if (!matchedFolder) {
      const errorMsg = `Could not find any directory with the name or similar to "${name}".`;
      return { success: false, response: errorMsg };
    }
        
    // Return the directory path
    return {
      success: true,
      response: { 
        type: "folder",
        path: matchedFolder.path,
      },
    };
  }
}
