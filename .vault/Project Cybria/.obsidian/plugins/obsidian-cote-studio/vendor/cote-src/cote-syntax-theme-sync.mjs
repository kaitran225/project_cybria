import {
  COTE_SYNTAX_THEME_EVENT,
  COTE_SYNTAX_THEME_STORAGE_KEY,
  parseCoteSyntaxTheme,
  readCoteSyntaxTheme,
} from '@kvi/shell';
import { settingsMap } from './settings.mjs';

/** Sync KVI Studio syntax theme preference → Strudel settings + CodeMirror. */
export function syncCoteSyntaxThemeFromStudio(themeName) {
  const theme = parseCoteSyntaxTheme(themeName);
  settingsMap.setKey('theme', theme);
  return theme;
}

export function initCoteSyntaxThemeSync(embedded) {
  if (!embedded || typeof window === 'undefined') {
    return () => {};
  }

  const apply = (value) => {
    const theme = syncCoteSyntaxThemeFromStudio(value ?? readCoteSyntaxTheme());
    import('@strudel/codemirror').then(({ activateTheme }) => activateTheme(theme));
  };

  if (!localStorage.getItem(COTE_SYNTAX_THEME_STORAGE_KEY)) {
    const fromStrudel = parseCoteSyntaxTheme(settingsMap.get().theme);
    localStorage.setItem(COTE_SYNTAX_THEME_STORAGE_KEY, fromStrudel);
  }

  apply(readCoteSyntaxTheme());

  const onCustom = (event) => apply(event.detail);
  const onStorage = (event) => {
    if (event.key === COTE_SYNTAX_THEME_STORAGE_KEY) {
      apply(event.newValue);
    }
  };

  window.addEventListener(COTE_SYNTAX_THEME_EVENT, onCustom);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(COTE_SYNTAX_THEME_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
