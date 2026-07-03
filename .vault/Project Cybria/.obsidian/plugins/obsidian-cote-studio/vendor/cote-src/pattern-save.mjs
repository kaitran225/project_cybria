import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { logger } from '@strudel/core';
import {
  STUDIO_AUTOSAVE_DEBOUNCE_MS,
  STUDIO_SAVE_PENDING_DELAY_MS,
} from '@kvi/shell';
import { isStudioProjectPatterns, persistPatternFile } from './project-patterns.mjs';
import { getViewingPatternData, userPattern } from './user_pattern_utils.mjs';

/** @typedef {'idle' | 'pending' | 'saving' | 'saved' | 'error'} PatternSaveStatusKind */

const $patternSaveState = atom({
  status: /** @type {PatternSaveStatusKind} */ ('idle'),
  error: null,
  savedAt: null,
});

export function usePatternSaveState() {
  return useStore($patternSaveState);
}

const lastSavedByPattern = new Map();
let debounceTimer = null;
let pendingStatusTimer = null;
let patternSaveEnabled = false;

/** @param {string | null | undefined} code */
export function isTransientPatternCode(code) {
  if (code == null) return true;
  const trimmed = String(code).trim();
  if (!trimmed) return true;
  return /^\/\/\s*loading/i.test(trimmed);
}

export function setPatternSaveEnabled(enabled) {
  patternSaveEnabled = Boolean(enabled);
  if (!enabled) cancelPendingPatternSave();
}

export function initPatternSaveBaseline(patterns = {}) {
  lastSavedByPattern.clear();
  for (const pattern of Object.values(patterns)) {
    if (pattern?.id) {
      lastSavedByPattern.set(pattern.id, pattern.code ?? '');
    }
  }
  $patternSaveState.set({ status: 'saved', error: null, savedAt: Date.now() });
}

export function clearPatternSaveBaseline(id) {
  if (id) lastSavedByPattern.delete(id);
}

export function isPatternDiskDirty(id, code) {
  if (!id) return false;
  const last = lastSavedByPattern.get(id);
  if (last === undefined) return true;
  return last !== code;
}

function canSaveViewingPattern() {
  if (!isStudioProjectPatterns()) return false;
  const viewing = getViewingPatternData();
  return viewing.collection === userPattern.collection && userPattern.isValidID(viewing.id);
}

function clearPendingStatusTimer() {
  if (pendingStatusTimer) {
    clearTimeout(pendingStatusTimer);
    pendingStatusTimer = null;
  }
}

export function markPatternSaved(id, code) {
  if (id) lastSavedByPattern.set(id, code ?? '');
  clearPendingStatusTimer();
  $patternSaveState.set({ status: 'saved', error: null, savedAt: Date.now() });
}

/**
 * @param {string} code
 * @param {{ force?: boolean, id?: string }} [options]
 */
export async function savePatternToDisk(code, options = {}) {
  const { force = false, id: overrideId } = options;

  if (isTransientPatternCode(code)) {
    return { ok: true, skipped: true };
  }

  if (!patternSaveEnabled && !force) {
    return { ok: true, skipped: true };
  }

  if (!canSaveViewingPattern()) {
    return { ok: true, skipped: true };
  }

  const viewing = getViewingPatternData();
  const id = overrideId ?? viewing.id;

  if (!force && !isPatternDiskDirty(id, code)) {
    return { ok: true, skipped: true };
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  clearPendingStatusTimer();

  const prev = $patternSaveState.get();
  $patternSaveState.set({ status: 'saving', error: null, savedAt: prev.savedAt });

  try {
    const data = {
      ...viewing,
      code: code ?? '',
      id,
      collection: userPattern.collection,
      file: viewing.file ?? `patterns/${id}.strudel`,
    };
    userPattern.update(id, data, { persistToDisk: false });
    await persistPatternFile(id, code ?? '');
    markPatternSaved(id, code ?? '');
    logger(`[cote] saved ${data.file}`, 'highlight');
    return { ok: true, id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    $patternSaveState.set({ status: 'error', error: message, savedAt: prev.savedAt });
    logger(`[cote] save failed: ${message}`, 'error');
    return { ok: false, error: message };
  }
}

export function schedulePatternSave(code) {
  if (!patternSaveEnabled) return;
  if (isTransientPatternCode(code)) return;
  if (!canSaveViewingPattern()) return;

  const viewing = getViewingPatternData();
  if (!isPatternDiskDirty(viewing.id, code)) {
    clearPendingStatusTimer();
    return;
  }

  const prev = $patternSaveState.get();
  if (prev.status !== 'saving') {
    if (pendingStatusTimer) clearTimeout(pendingStatusTimer);
    pendingStatusTimer = setTimeout(() => {
      pendingStatusTimer = null;
      if (isPatternDiskDirty(viewing.id, code)) {
        $patternSaveState.set({ status: 'pending', error: null, savedAt: prev.savedAt });
      }
    }, STUDIO_SAVE_PENDING_DELAY_MS);
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void savePatternToDisk(code);
  }, STUDIO_AUTOSAVE_DEBOUNCE_MS);
}

export function flushPatternSave(code) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  clearPendingStatusTimer();
  return savePatternToDisk(code, { force: true });
}

export function cancelPendingPatternSave() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  clearPendingStatusTimer();
}
