import { createContext, useContext } from 'react';

export const CoteEmbeddedContext = createContext(false);

export function useCoteEmbedded() {
  return useContext(CoteEmbeddedContext);
}

/** True when Cote Studio runs inside KVI Studio (set on documentElement in App.tsx). */
export function isCoteEmbedded() {
  return typeof document !== 'undefined' && document.documentElement.dataset.coteEmbedded === 'true';
}
