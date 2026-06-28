import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getApp } from "src/plugin";
import { findMatchingFolder } from 'src/utils/notes/searching';
import { getNextAvailableFileName } from "src/utils/notes/renaming";
import { formatTags } from 'src/utils/notes/tags';
import { writingSystemPrompt } from 'src/backend/managers/prompts/library';
import { callModel } from 'src/backend/managers/modelRunner';


export const createNoteTool = tool(
  async ({ topic, name, tags, context, dirPath, content, useLlm }) =>
    createNote(topic, name, tags, context, dirPath, content, useLlm),
  {
    name: "create_note",
    description: "Create a note. Content can be generated with a topic or provided manually. If no name provided a default one will be used.",
    schema: z.object({
      topic: z.string().optional().describe("The topic of the note, what is going to be written about"),
      name: z.string().optional().describe("The note name the user provided with markdown file extension .md"),
      tags: z.array(z.string()).optional().describe("The tags the user wants to add to the note, do not make them up"),
      context: z.string().optional().describe("Context the user provided to write the note"),
      dirPath: z.string().optional().describe("The path of the directory where the note is going to be stored"),
      content: z.string().optional().describe("Custom markdown content to use instead of generating"),
      useLlm: z.boolean().optional().describe("Whether to use the LLM to generate the content."),
    }),
  }
);

// Obsidian tool to write notes
export async function createNote(
  topic = "",
  name = "Generated note.md",
  tags: string[] = [],
  context = "",
  dirPath = "",
  content = "",
  useLlm = true,
) {
  const app = getApp();
  
  // Find the closest folder
  const matchedFolder = findMatchingFolder(dirPath);
  if (!matchedFolder) {
    return { success: false, response: `Could not find any directory with the path ${dirPath}` }
  }
  dirPath = matchedFolder.path;
  

  if (!name.endsWith('.md')) name += '.md'; 
  let fullPath = dirPath + '/' + name; // -> ParentPath/Name.md
  if (!dirPath || dirPath === '/') fullPath = name; // -> Name.md
  
  // Content generation
  if (!content) {
    if (topic && useLlm) {
      let sysPrompt = writingSystemPrompt;
      if (context) sysPrompt += `\nUse the following context to write the note: ${context}.`;

      const humanPrompt = `Write a note following this topic/instruction: ${topic}.`;
      
      try {
        const response = await callModel(sysPrompt, humanPrompt, []);
        content = response;

        if (tags.length > 0) content = formatTags(tags) + "\n" + content

      } catch (error) {
        return { success: false, response: String(error) };
      }
    } else if (tags.length > 0) {
      content = formatTags(tags);
    }
  }

  // Check if the note already exists
  // Append a number to the file name if it already exists
  if (app.vault.getAbstractFileByPath(fullPath)) {
    const newName = getNextAvailableFileName(name, dirPath);
    name = newName;

    fullPath = dirPath + '/' + name;
    if (!dirPath || dirPath === '/') fullPath = name; // -> Name.md
  }

  // Clean content
  content = content.trim();
  if (content.startsWith('\n')) content = content.slice(1);

  await app.vault.create(fullPath, content);
  return { 
    success: true,
    response: `Note created successfully at: ${fullPath}.`, 
  };
}
