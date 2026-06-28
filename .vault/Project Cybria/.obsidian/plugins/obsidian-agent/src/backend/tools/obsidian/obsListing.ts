import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { findMatchingFolder } from 'src/utils/notes/searching'
import { getFolderStructure } from 'src/utils/vault/vaultStructure';


export const listFilesTool = tool(
  async ({ dirPath, limit }) => listFiles(dirPath, limit),
  {
    name: "list_files",
    description: "List files and directories of a directory.",
    schema: z.object({
      dirPath: z.string().describe("The path of the directory to list files from"),
      limit: z.number().int().optional().describe("The maximum number of files and directories to list"),
    }),
  }
);

// List a tree of files and directories in a directory
export async function listFiles(
  dirPath: string, 
  limit = 10,
) {
  // Find the matching folder if the path is not absolute    
  const matchingFolder = findMatchingFolder(dirPath);
  if (!matchingFolder) {
    return { success: false, response: `Directory ${dirPath} not found` };
  }

  // Get the folder structure in a tree form
  const tree = {
    type: 'folder',
    path: matchingFolder.path,
    children: getFolderStructure(matchingFolder, limit)
  };

  return {
    success: true,
    response: tree
  };
}
