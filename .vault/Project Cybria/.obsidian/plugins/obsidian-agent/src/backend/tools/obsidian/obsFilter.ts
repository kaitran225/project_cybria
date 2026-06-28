import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getApp } from 'src/plugin';
import { parseDateRange } from 'src/utils/formatting/dateFormat';


// dateRange accepts either a relative string ("1h", "2w", ...) or an explicit
// { start, end } range, where each bound is a string: a unix ms timestamp,
// an ISO datetime string, or a "YYYY-MM-DD" date string.
// Note: bounds are kept as strings (not number|string unions) because the
// Gemini function-calling schema converter rejects nested "anyOf" unions.
const dateRangeSchema = z.union([
  z.string(),
  z.object({
    start: z.string(),
    end: z.string(),
  }),
]);

export const noteFilteringTool = tool(
  async ({ field, dateRange, limit, sortOrder }) =>
    noteFiltering(field, dateRange, limit, sortOrder),
  {
    name: "filter_notes",
    description: `
Return a list of note paths that fall inside a date range.
dateRange formats supported:
  1) Relative strings: "<int><unit>" where unit is: s (seconds), m (minutes), h (hours), d (days), w (weeks).
     Examples: "1h", "48m", "2w", "3d".

  2) Explicit range object: { "start": <ms|ISO|YYYY-MM-DD>, "end": <ms|ISO|YYYY-MM-DD> }.
     - If start/end are "YYYY-MM-DD" the day bounds are used (start=00:00, end=23:59:59.999 local).
     - start/end can also be unix ms (number) or full ISO datetime string.
  `,
    schema: z.object({
      field: z.enum(["creation", "modification"]).optional().describe("The field to filter notes by, either creation or modification date."),
      dateRange: dateRangeSchema.describe(`
Date range to filter notes.
Supported formats:
  1) Relative strings: "1h", "48m", "2w", "3d", "1d", etc.
  2) Explicit objects: { "start": <ms|ISO|YYYY-MM-DD>, "end": <ms|ISO|YYYY-MM-DD> }.
If YYYY-MM-DD is provided, day bounds are applied (start=00:00, end=23:59:59.999 local time).
      `),
      limit: z.number().int().optional().describe("Maximum number of notes to return."),
      sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort by date ascending or descending."),
    }),
  }
);

// Search notes based on their date of modification or creation
export async function noteFiltering(
  field = "modification",
  dateRange: string | { start: string; end: string },
  limit = 10,
  sortOrder = "desc",
) {
  const app = getApp();
  
  // Parse dateRange
  if (typeof dateRange !== "string" && typeof dateRange !== "object") {
    return { success: false, response: `Invalid 'dateRange' type, expected string or object, got ${typeof dateRange}.` };
  }
  const validDateRange = parseDateRange(dateRange);
  if (!validDateRange) return { success: false, response: `Invalid date range: ${JSON.stringify(dateRange)}.` };
  // By now validDateRange is guaranteed to be a {start: number, end: number} object

  // Get notes based on the date range and field  
  const notes = app.vault.getMarkdownFiles().filter(file => {
    const fileTime = field === "creation" ? file.stat.ctime : file.stat.mtime;
    return fileTime >= validDateRange.start && fileTime <= validDateRange.end;
  });

  // Sort notes
  notes.sort((a, b) => {
    const timeA = field === "creation" ? a.stat.ctime : a.stat.mtime;
    const timeB = field === "creation" ? b.stat.ctime : b.stat.mtime;
    return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
  });

  // Limit notes
  const limitedNotes = notes.slice(0, limit);

  // Gather note paths
  const notePaths = limitedNotes.map(note => (note.path ));

  return { 
    success: true, 
    response: notePaths,
  };
}
