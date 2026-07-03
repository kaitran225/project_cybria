/** In-app Cote docs route inside KVI Studio. */
export const COTE_DOCS_BASE = "/app/cote-studio/docs";

/** @deprecated Use COTE_DOCS_BASE */
export const STRUDEL_DOCS_BASE = COTE_DOCS_BASE;

/** Build a docs path with optional slug and hash fragment. */
export function coteDocsPath(slug = "", hash = "") {
  const normalized = slug ? slug.replace(/^\//, "").replace(/\/$/, "") : "";
  const path = normalized ? `${COTE_DOCS_BASE}/${normalized}` : COTE_DOCS_BASE;
  if (!hash) return path;
  return `${path}${hash.startsWith("#") ? hash : `#${hash}`}`;
}
