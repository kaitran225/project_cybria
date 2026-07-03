import { getLaneKey, getPunchcardPainter, invalidatePianorollLabelCache, sortLaneKeys } from '@strudel/draw';
import { cleanupDraw } from '@strudel/draw';
import { parseBoolean, settingsMap } from '../settings.mjs';

export const PIANOROLL_CANVAS_ID = 'cote-pianoroll-canvas';
export const PIANOROLL_LANE_LABEL_WIDTH_CSS = 140;
/** Visible window: 3 cycles behind, 5 ahead */
export const PIANOROLL_DRAW_TIME = [3, 5];
export const PIANOROLL_CYCLES = PIANOROLL_DRAW_TIME[0] + PIANOROLL_DRAW_TIME[1];
export const PIANOROLL_LANE_QUERY_CYCLES = 8;
/** Compact row height bounds (CSS px) — scales up to fill the piano body */
export const PIANOROLL_ROW_HEIGHT_CSS = 24;
export const PIANOROLL_ROW_HEIGHT_MIN_CSS = 24;
export const PIANOROLL_ROW_HEIGHT_MAX_CSS = 24;

let currentPianorollLaneCount = 0;
let cachedPainter = null;
let cachedPainterKey = '';

function devicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

export function isPianorollViewEnabled() {
  return parseBoolean(settingsMap.get().pianorollView);
}

export function getPianorollLaneCount() {
  return currentPianorollLaneCount;
}

function getPianorollCanvasLayoutHeight() {
  const canvas = document.getElementById(PIANOROLL_CANVAS_ID);
  const body = canvas?.closest('.cote-repl-widget__body--piano');
  return body?.clientHeight ?? canvas?.parentElement?.clientHeight ?? 0;
}

/** Scale row height to fill the piano body when lanes allow; scroll when they do not. */
export function computePianorollRowHeightCss(_layoutWidthCss, laneCount = currentPianorollLaneCount) {
  const lanes = Math.max(1, laneCount || 1);
  const height = getPianorollCanvasLayoutHeight();
  if (height > 0) {
    const fitted = Math.floor((height - 2) / lanes);
    return Math.max(
      PIANOROLL_ROW_HEIGHT_MIN_CSS,
      Math.min(PIANOROLL_ROW_HEIGHT_MAX_CSS, fitted),
    );
  }
  return PIANOROLL_ROW_HEIGHT_CSS;
}

function computeRowHeightDevicePx(layoutWidthCss, laneCount) {
  return Math.floor(computePianorollRowHeightCss(layoutWidthCss, laneCount) * devicePixelRatio());
}

function getPianorollCanvasLayoutWidth() {
  const canvas = document.getElementById(PIANOROLL_CANVAS_ID);
  const body = canvas?.closest('.cote-repl-widget__body--piano');
  return body?.clientWidth ?? canvas?.parentElement?.clientWidth ?? 0;
}

export function collectPianorollLanes(pat, cycles = PIANOROLL_LANE_QUERY_CYCLES) {
  const values = new Set();
  try {
    const haps = pat.queryArc(0, cycles);
    for (const hap of haps) {
      values.add(getLaneKey(hap));
    }
  } catch {
    // pattern may not be queryable yet
  }
  return sortLaneKeys([...values]);
}

export function syncPianorollCanvas(laneCount = currentPianorollLaneCount) {
  const canvas = document.getElementById(PIANOROLL_CANVAS_ID);
  if (!canvas) {
    return null;
  }
  const parent = canvas.parentElement;
  if (!parent || parent.clientWidth <= 0) {
    return canvas.getContext('2d');
  }
  const ratio = devicePixelRatio();
  const layoutW = parent.clientWidth;
  const lanes = Math.max(1, laneCount);
  const rowPx = computeRowHeightDevicePx(layoutW, lanes);
  const contentHeight = lanes * rowPx + 2;

  canvas.width = Math.max(1, Math.floor(layoutW * ratio));
  canvas.height = Math.max(1, contentHeight);
  canvas.style.width = '100%';
  canvas.style.height = `${contentHeight / ratio}px`;
  canvas.dataset.laneCount = String(laneCount);
  return canvas.getContext('2d');
}

export function resolveDrawContext(laneCount = 0) {
  const ctx = syncPianorollCanvas(laneCount);
  if (ctx) {
    return ctx;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.getContext('2d');
}

export function getPianorollPunchcardOptions(foldValues = [], layoutWidthCss) {
  const ratio = devicePixelRatio();
  const layoutW = layoutWidthCss ?? getPianorollCanvasLayoutWidth();
  const laneCount = Math.max(1, foldValues.length || 1);
  const rowHeight = computeRowHeightDevicePx(layoutW, laneCount);
  const lanePad = Math.max(1, Math.floor(rowHeight * 0.08));
  return {
    tileLabels: 1,
    laneLabels: 1,
    fill: 0,
    fillActive: 1,
    stroke: 1,
    strokeActive: false,
    colorizeInactive: 0,
    fold: 1,
    rowHeight,
    inactive: '#5a5a64',
    active: '#bfff00',
    playheadColor: '#f5f5f5',
    playheadWidth: 2 * ratio,
    background: 'transparent',
    preloadLanes: 1,
    lanePad,
    laneGutterWidth: 0,
    laneFadeWidth: 0,
    laneLabelWidth: PIANOROLL_LANE_LABEL_WIDTH_CSS * ratio,
    laneLabelSourceColor: '#808080',
    laneLabelNoteColor: '#e8e8ec',
    fontFamily: 'system-ui,sans-serif',
    foldValues,
  };
}

function getCachedPainter(foldValues, layoutWidthCss) {
  const layoutW = layoutWidthCss ?? getPianorollCanvasLayoutWidth();
  const laneCount = Math.max(1, foldValues.length || 1);
  const rowHeightCss = computePianorollRowHeightCss(layoutW, laneCount);
  const key = `${foldValues.join('\0')}|${layoutW}|${rowHeightCss}`;
  if (cachedPainterKey === key && cachedPainter) {
    return cachedPainter;
  }
  cachedPainterKey = key;
  cachedPainter = getPunchcardPainter(getPianorollPunchcardOptions(foldValues, layoutW));
  return cachedPainter;
}

export function wrapPatternWithPianoroll(pat) {
  if (!isPianorollViewEnabled()) {
    return pat;
  }
  invalidatePianorollLabelCache();
  const foldValues = collectPianorollLanes(pat);
  currentPianorollLaneCount = foldValues.length;
  syncPianorollCanvas(foldValues.length);
  let lastLayoutW = 0;
  let lastLayoutH = 0;

  return pat.onPaint((ctx, time, haps, drawTime) => {
    const layoutW = getPianorollCanvasLayoutWidth();
    const layoutH = getPianorollCanvasLayoutHeight();
    if (
      layoutW > 0 &&
      (Math.abs(layoutW - lastLayoutW) > 1 || Math.abs(layoutH - lastLayoutH) > 1)
    ) {
      lastLayoutW = layoutW;
      lastLayoutH = layoutH;
      syncPianorollCanvas(foldValues.length);
      cachedPainter = null;
      cachedPainterKey = '';
    }
    getCachedPainter(foldValues, layoutW)(ctx, time, haps, drawTime);
    const ratio = devicePixelRatio();
    ctx.canvas.style.height = `${ctx.canvas.height / ratio}px`;
  });
}

export function applyPianorollViewToEditor(editor, enabled) {
  if (!editor) {
    return;
  }
  const drawTime = enabled ? PIANOROLL_DRAW_TIME : [-2, 2];
  editor.drawTime = drawTime;
  editor.drawer?.setDrawTime(drawTime);

  const ctx = syncPianorollCanvas();
  if (ctx) {
    editor.drawContext = ctx;
  }

  if (enabled) {
    void editor.drawFirstFrame?.();
  } else {
    cleanupDraw(true, editor.id);
    cachedPainter = null;
    cachedPainterKey = '';
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    currentPianorollLaneCount = 0;
  }

  void editor.evaluate(false);
}

export function refreshPianorollCanvas(editor) {
  if (!editor || !isPianorollViewEnabled()) {
    return;
  }
  invalidatePianorollLabelCache();
  cachedPainter = null;
  cachedPainterKey = '';
  const ctx = syncPianorollCanvas(currentPianorollLaneCount);
  if (ctx) {
    editor.drawContext = ctx;
    void editor.drawFirstFrame?.();
  }
}

export function togglePianorollView() {
  const next = !isPianorollViewEnabled();
  settingsMap.setKey('pianorollView', next);
  return next;
}
