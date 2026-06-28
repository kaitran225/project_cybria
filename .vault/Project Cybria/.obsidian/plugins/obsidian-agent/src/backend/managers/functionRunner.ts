import { createNoteTool } from "src/backend/tools/obsidian/obsCreate";
import { editNoteTool } from "src/backend/tools/obsidian/obsEdit";
import { readNoteTool } from "src/backend/tools/obsidian/obsRead";
import { createDirTool } from "src/backend/tools/obsidian/obsDir";
import { noteFilteringTool } from "src/backend/tools/obsidian/obsFilter";
import { listFilesTool } from "src/backend/tools/obsidian/obsListing";
import { vaultSearchTool } from "src/backend/tools/obsidian/obsSearch";

// All vault tools the agent can call. createAgent dispatches and executes
// these directly, no manual switch-based routing is needed anymore.
export const vaultTools = [
  createNoteTool,
  editNoteTool,
  readNoteTool,
  createDirTool,
  noteFilteringTool,
  listFilesTool,
  vaultSearchTool,
];
