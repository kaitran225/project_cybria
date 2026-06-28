import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChangeObject, diffLines } from "diff";
import { App, TFile } from 'obsidian';
import { getApp, getSettings } from "src/plugin";
import { findClosestFile } from 'src/utils/notes/searching';
import { formatTags } from 'src/utils/notes/tags';
import { writingSystemPrompt } from 'src/backend/managers/prompts/library';
import { callModel } from 'src/backend/managers/modelRunner';
import { DiffReviewModal } from "src/feature/modals/DiffReviewModal";


export const editNoteTool = tool(
  async ({ fileName, activeNote, newContent, useLlm, tags, context }) =>
    editNote(fileName, activeNote, newContent, useLlm, tags, context),
  {
    name: "edit_note",
    description: "Write, replace and edit content of a note. Can use LLM or not, supports tags and context. Specify the note name or detect the active note if no name provided.",
    schema: z.object({
      fileName: z.string().optional().describe("The name or path of the note to edit. Without the markdown extension .md"),
      activeNote: z.boolean().optional().describe("If no filename provided set to true to read the active note"),
      newContent: z.string().describe("New content or instructions to apply to the note"),
      useLlm: z.boolean().optional().describe("Whether to use the LLM to generate content for the note"),
      tags: z.array(z.string()).optional().describe("Tags to add in the note, do not make them up"),
      context: z.string().optional().describe("Additional context for the LLM to use when editing"),
    }),
  }
);

// Obsidian tool to update or write on existing notes
export async function editNote(
  fileName = "",
  activeNote = false,
  newContent: string,
  useLlm = true,
  tags: string[] = [],
  context = "",
) {
  const app = getApp();
  const settings = getSettings();
    
  let matchedFile: TFile | null;

  if (activeNote) {
    // Detect the current note
    matchedFile = app.workspace.getActiveFile()
    if (!matchedFile) {
      const errorMsg = "It seems like there is not an active note, and you haven't opened any recently."
      if (settings.debug) console.error(errorMsg);
      
      return { success: false, response: errorMsg}
    }
  } else if (fileName && !activeNote) {
    // Find the closest file
    matchedFile = findClosestFile(fileName);
    if (!matchedFile) {
      const errorMsg = `Could not find any note with the exact name or similar to "${fileName}".`
      if (settings.debug) console.error(errorMsg);
      
      return { success: false, response: errorMsg };
    }
  } else {
    const errorMsg = "No file name provided and 'active note' is not set as true.";
    if (settings.debug) console.error(errorMsg);
    
    return { success: false, response: errorMsg };
  }

  // Read the file
  const oldContent = await app.vault.read(matchedFile);
  let updatedContent: string;

  // If the user do not want to generate content replace directly
  if (!useLlm && (newContent || tags.length > 0)) {
    updatedContent = newContent || oldContent;
    if (tags.length > 0) updatedContent = formatTags(tags) + '\n' + updatedContent;

  } else if (useLlm) {
    let sysPrompt = writingSystemPrompt;
    if (context) sysPrompt += `\nYou can use the following context to edit the note: ${context}`;

    const humanPrompt = `Update the following markdown note:\n###\n${oldContent}\n###` +
      (newContent ? `Apply the following update or topic: "${newContent}".\n`: '') +
      `Return the full updated markdown note. Do not remove any existing content unless specified (including links and paths).`;

    try {
      const response = await callModel(sysPrompt, humanPrompt, []);
      if (typeof response !== "string") throw new Error("Invalid response from LLM");
      updatedContent = response;

      if (tags.length > 0) updatedContent = formatTags(tags) + '\n' + updatedContent;

    } catch (error) {
      const errorMsg = 'Error invoking LLM: ' + String(error);
      if (settings.debug) console.error(errorMsg);
      
      return { success: false, response: errorMsg };
    }
  } else {
    const errorMsg = 'No new content, tags, or topic provided to update the note.';  
    if (settings.debug) console.error(errorMsg);
    
    return { success: false, response: errorMsg };
  }

  // Clean updated content
  updatedContent = updatedContent.trim();
  if (updatedContent.startsWith("\n")) {
    // Remove the leading new line
    updatedContent = updatedContent.slice(1);
  }

  if (updatedContent === oldContent) return { success: true, response: "No changes made" };

  let finalContent, finalDiff;
  if (settings.reviewChanges) {
    ({ finalContent, finalDiff } = await initReview(app, oldContent, updatedContent));
  } else {
    finalContent = updatedContent;
    finalDiff = diffLines(oldContent, updatedContent);  
  }

  // Save the updated content
  await app.vault.modify(matchedFile, finalContent);

  return { 
    success: true, 
    response: {
      diff: finalDiff, 
      tags,
    }
  };
}


async function initReview(
  app: App,
  oldContent: string,
  newContent: string,
): Promise<{ finalContent: string, finalDiff: ChangeObject<string>[] }> {
  
  return new Promise<{ finalContent: string, finalDiff: ChangeObject<string>[] }>((resolve) => {
    const modal = new DiffReviewModal(
      app,
      (finalContent: string, finalDiff: ChangeObject<string>[]) => {
        resolve({ finalContent, finalDiff });
      },
      (finalContent: string, finalDiff: ChangeObject<string>[]) => { 
        resolve({ finalContent, finalDiff }) 
      },
      oldContent,
      newContent
    );
    modal.open();
  });
}
