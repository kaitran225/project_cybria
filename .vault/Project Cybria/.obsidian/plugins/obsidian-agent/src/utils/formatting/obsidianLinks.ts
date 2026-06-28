// Converts Obsidian wiki-links ([[note]] or [[note.md]]) found in model output
// into markdown links that open the note in the vault, so they render as
// clickable links when displayed in the chat (messages and reasoning blocks).
export function convertWikiLinksToMarkdown(content: string): string {
  if (!content) return "";

  return content.replace(".md]]", "]]").replace(/\[\[([^\]]+)\]\]/g, (_, p1) => {
    const encoded = encodeURIComponent(p1.trim());
    return `[${p1.trim()}](obsidian://open?file=${encoded})`;
  });
}
