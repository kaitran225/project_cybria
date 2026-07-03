import { useEffect } from "react";

export const STUDIO_AUTOSAVE_DEBOUNCE_MS = 1200;
export const STUDIO_SAVE_PENDING_DELAY_MS = 200;

export const COTE_SYNTAX_THEME_STORAGE_KEY = "kvi.cote.syntaxTheme.v1";
export const COTE_SYNTAX_THEME_EVENT = "kvi-cote-syntax-theme-change";
export const COTE_SYNTAX_THEMES = ["strudelTheme", "dracula", "nord"] as const;

export type CoteSyntaxTheme = (typeof COTE_SYNTAX_THEMES)[number];

export function parseCoteSyntaxTheme(value: string | null | undefined): CoteSyntaxTheme {
  if (value === "dracula" || value === "nord" || value === "strudelTheme") return value;
  return "strudelTheme";
}

export function readCoteSyntaxTheme(): CoteSyntaxTheme {
  if (typeof localStorage === "undefined") return "strudelTheme";
  return parseCoteSyntaxTheme(localStorage.getItem(COTE_SYNTAX_THEME_STORAGE_KEY));
}

export function useStudioSaveShortcut(
  flushSave: () => void | Promise<void>,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "s") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      void flushSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, flushSave]);
}

export function StudioSaveStatusChip({
  status = "idle",
  dirty,
  saving,
  error,
  className = "",
}: {
  status?: string;
  dirty?: boolean;
  saving?: boolean;
  error?: string | null;
  className?: string;
}) {
  let label = "";
  if (saving || status === "saving") label = "Saving…";
  else if (status === "error") label = error?.trim() || "Save failed";
  else if (dirty || status === "pending") label = "Unsaved";
  else if (status === "saved") label = "Saved";

  if (!label) return null;

  return (
    <span className={`cote-save-status ${className}`.trim()} title={error?.trim() ? error : label}>
      {label}
    </span>
  );
}
