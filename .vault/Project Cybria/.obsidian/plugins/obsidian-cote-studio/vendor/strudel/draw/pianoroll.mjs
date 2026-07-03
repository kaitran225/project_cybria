/*
pianoroll.mjs - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/canvas/pianoroll.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Pattern, noteToMidi, freqToMidi, isPattern } from '@strudel/core';
import { getTheme, getDrawContext } from './draw.mjs';

const scale = (normalized, min, max) => normalized * (max - min) + min;
const getValue = (e) => {
  let { value } = e;
  if (typeof e.value !== 'object') {
    value = { value };
  }
  let { note, n, freq, s } = value;
  if (freq) {
    return freqToMidi(freq);
  }
  note = note ?? n;
  if (typeof note === 'string') {
    try {
      // TODO: n(run(32)).scale("D:minor") fails when trying to query negative time..
      return noteToMidi(note);
    } catch (err) {
      // console.warn(`error converting note to midi: ${err}`); // this spams to crazy
      return 0;
    }
  }
  if (typeof note === 'number') {
    return note;
  }
  if (s) {
    return '_' + s;
  }
  return value;
};

const LANE_KEY_SEP = '#';

function getSourceFingerprint(value) {
  if (!value || typeof value !== 'object') {
    return 'default';
  }
  const { s, bank, n, orbit, label } = value;
  const parts = [];
  if (bank) {
    parts.push(bank);
  }
  if (s) {
    parts.push(s);
    if (n != null && n !== '') {
      parts.push(String(n));
    }
  } else if (orbit != null && orbit !== 1) {
    parts.push(`o${orbit}`);
  } else if (label) {
    parts.push(label);
  }
  return parts.length ? parts.join(':') : 'default';
}

/** Lane identity: distinct source + pitch (for fold rows in stacked patterns). */
export function getLaneKey(e) {
  const pitch = getValue(e);
  let { value } = e;
  if (typeof value !== 'object') {
    value = { value };
  }
  return `${getSourceFingerprint(value)}${LANE_KEY_SEP}${pitch}`;
}

export function laneLabelFromKey(laneKey) {
  const { source, note } = laneLabelPartsFromKey(laneKey);
  if (source && note) {
    return `${source} ${note}`;
  }
  return source || note;
}

export function laneLabelPartsFromKey(laneKey) {
  const sep = laneKey.indexOf(LANE_KEY_SEP);
  if (sep < 0) {
    const pitch =
      typeof laneKey === 'string' && laneKey.startsWith('_') ? laneKey.slice(1) : String(laneKey);
    return { source: '', note: pitch };
  }
  const source = laneKey.slice(0, sep);
  const pitch = laneKey.slice(sep + 1);
  const note = typeof pitch === 'string' && pitch.startsWith('_') ? pitch.slice(1) : String(pitch);
  if (source === 'default') {
    return { source: '', note };
  }
  const sourceRoot = source.split(':')[0];
  if (note === sourceRoot || pitch === `_${sourceRoot}`) {
    return { source, note: '' };
  }
  return { source, note };
}

export function sortLaneKeys(keys) {
  return [...keys].sort((a, b) => {
    const sepA = a.indexOf(LANE_KEY_SEP);
    const sepB = b.indexOf(LANE_KEY_SEP);
    const srcA = sepA >= 0 ? a.slice(0, sepA) : '';
    const srcB = sepB >= 0 ? b.slice(0, sepB) : '';
    const pitchA = sepA >= 0 ? a.slice(sepA + 1) : a;
    const pitchB = sepB >= 0 ? b.slice(sepB + 1) : b;
    const srcCmp = srcA.localeCompare(srcB);
    if (srcCmp !== 0) {
      return srcCmp;
    }
    const numA = Number(pitchA);
    const numB = Number(pitchB);
    if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return String(pitchA).localeCompare(String(pitchB));
  });
}

function laneStripeColor(rowIndex) {
  return rowIndex % 2 ? '#101014' : '#0c0c10';
}

function tileLabelFromEvent(event, isActive) {
  const v = event.value || {};
  const { label: inactiveLabel, activeLabel, note, n, s } = v;
  const custom = isActive ? activeLabel || inactiveLabel : inactiveLabel;
  if (custom != null && custom !== '') {
    return String(custom);
  }
  if (note != null && note !== '') {
    return String(note);
  }
  if (n != null && n !== '') {
    return String(n);
  }
  if (s) {
    return String(s);
  }
  return '';
}

function paintLaneLabelColumn(
  ctx,
  foldValues,
  barThickness,
  flipValues,
  labelWidth,
  { laneLabels, fontFamily, laneLabelSourceColor, laneLabelNoteColor },
) {
  const pad = 6;
  foldValues.forEach((laneKey, rowIndex) => {
    const laneY = flipValues ? ctx.canvas.height - (rowIndex + 1) * barThickness : rowIndex * barThickness;
    if (!laneLabels) {
      return;
    }
    const { source, note } = laneLabelPartsFromKey(laneKey);
    const measure = Math.max(9, barThickness * 0.4);
    ctx.font = `500 ${measure}px ${fontFamily || 'system-ui,sans-serif'}`;
    ctx.textBaseline = 'middle';
    const midY = laneY + barThickness / 2;
    if (source) {
      ctx.textAlign = 'left';
      ctx.fillStyle = laneLabelSourceColor;
      ctx.fillText(source, pad, midY);
    }
    if (note) {
      ctx.textAlign = 'right';
      ctx.fillStyle = laneLabelNoteColor;
      ctx.fillText(note, labelWidth - pad, midY);
    } else if (!source) {
      ctx.textAlign = 'right';
      ctx.fillStyle = laneLabelNoteColor;
      ctx.fillText(laneKey, labelWidth - pad, midY);
    }
  });
}

let labelColumnCache = { key: '', canvas: null };

export function invalidatePianorollLabelCache() {
  labelColumnCache = { key: '', canvas: null };
}

function getLabelColumnCache(
  foldValues,
  barThickness,
  flipValues,
  labelWidth,
  laneOptions,
) {
  const height = foldValues.length * barThickness + 2;
  const key = [
    foldValues.join('\0'),
    labelWidth,
    barThickness,
    height,
    laneOptions.fontFamily,
    laneOptions.laneLabelSourceColor,
    laneOptions.laneLabelNoteColor,
  ].join('|');
  if (labelColumnCache.key === key && labelColumnCache.canvas?.height === height) {
    return labelColumnCache.canvas;
  }
  const canvas = document.createElement('canvas');
  canvas.width = labelWidth;
  canvas.height = height;
  paintLaneLabelColumn(canvas.getContext('2d'), foldValues, barThickness, flipValues, labelWidth, {
    laneLabels: true,
    fontFamily: laneOptions.fontFamily,
    laneLabelSourceColor: laneOptions.laneLabelSourceColor,
    laneLabelNoteColor: laneOptions.laneLabelNoteColor,
  });
  labelColumnCache = { key, canvas };
  return canvas;
}

function blitLaneLabelColumn(ctx, foldValues, barThickness, flipValues, labelWidth, laneOptions) {
  if (!labelWidth || !foldValues.length) {
    return;
  }
  const cache = getLabelColumnCache(foldValues, barThickness, flipValues, labelWidth, laneOptions);
  ctx.drawImage(cache, 0, 0, labelWidth, cache.height, 0, 0, labelWidth, cache.height);
}

function paintLaneGutterRow(
  ctx,
  {
    laneKey,
    laneY,
    barThickness,
    gutterWidth,
    fadeWidth,
    rowIndex,
    fontFamily,
    laneLabelBg,
    laneLabelSourceColor,
    laneLabelNoteColor,
    laneLabels,
    paintFade = true,
  },
) {
  const pad = 8;
  const stripe = laneStripeColor(rowIndex);

  ctx.fillStyle = laneLabelBg || stripe;
  ctx.fillRect(0, laneY, gutterWidth, barThickness);

  if (laneLabels) {
    const { source, note } = laneLabelPartsFromKey(laneKey);
    const measure = Math.max(9, barThickness * 0.4);
    ctx.font = `500 ${measure}px ${fontFamily || 'system-ui,sans-serif'}`;
    ctx.textBaseline = 'middle';
    ctx.margin = 10;
    ctx.padding = 10;
    const midY = laneY + barThickness / 2;
    if (source) {
      ctx.textAlign = 'left';
      ctx.fillStyle = laneLabelSourceColor;
      ctx.fillText(source, pad, midY);
    }
    if (note) {
      ctx.textAlign = 'right';
      ctx.fillStyle = laneLabelNoteColor;
      ctx.fillText(note, gutterWidth - pad, midY);
    } else if (!source) {
      ctx.textAlign = 'right';
      ctx.fillStyle = laneLabelNoteColor;
      ctx.fillText(laneKey, gutterWidth - pad, midY);
    }
  }

  if (paintFade && fadeWidth > 0) {
    const grad = ctx.createLinearGradient(gutterWidth, 0, gutterWidth + fadeWidth, 0);
    grad.addColorStop(0, stripe);
    grad.addColorStop(0.3, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(gutterWidth, laneY, fadeWidth, barThickness);
  }
}

function paintLaneGutterOverlay(ctx, foldValues, barThickness, flipValues, options) {
  const {
    laneGutterWidth = 0,
    laneFadeWidth = 0,
    laneLabels = false,
    fontFamily,
    laneLabelBg,
    laneLabelSourceColor,
    laneLabelNoteColor,
    paintFade = true,
  } = options;
  if (!laneGutterWidth) {
    return;
  }
  foldValues.forEach((laneKey, rowIndex) => {
    const laneY = flipValues ? ctx.canvas.height - (rowIndex + 1) * barThickness : rowIndex * barThickness;
    paintLaneGutterRow(ctx, {
      laneKey,
      laneY,
      barThickness,
      gutterWidth: laneGutterWidth,
      fadeWidth: laneFadeWidth,
      rowIndex,
      fontFamily,
      laneLabelBg,
      laneLabelSourceColor,
      laneLabelNoteColor,
      laneLabels,
      paintFade,
    });
  });
}

function paintTileLabels(ctx, tileLabelDraws, fontFamily, laneInset = 0) {
  ctx.globalAlpha = 1;
  const minTileWidth = 12;
  for (const { label, coords, fillCurrent } of tileLabelDraws) {
    if (!label) {
      continue;
    }
    const [x, y, w, h] = coords;
    if (w < minTileWidth) {
      continue;
    }
    if (laneInset > 0 && x + w <= laneInset) {
      continue;
    }
    const measure = Math.max(9, h * 0.72);
    ctx.font = `500 ${measure}px ${fontFamily || 'system-ui,sans-serif'}`;
    if (ctx.measureText(label).width + 8 > w) {
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = fillCurrent ? '#0f0f0f' : '#d0d0d8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 4, y + h / 2);
    ctx.restore();
  }
}

function sortLaneValues(values) {
  if (values.some((v) => typeof v === 'string' && v.includes(LANE_KEY_SEP))) {
    return sortLaneKeys(values);
  }
  return sortFoldValues(values);
}

export function sortFoldValues(values) {
  return [...values].sort((a, b) =>
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : typeof a === 'number'
        ? 1
        : String(a).localeCompare(String(b)),
  );
}

export { getValue };

/**
 * Visualises a pattern as a scrolling 'pianoroll', displayed in the background of the editor. To show a pianoroll for all running patterns, use `all(pianoroll)`. To have a pianoroll appear below
 * a pattern instead, prefix with `_`, e.g.: `sound("bd sd")._pianoroll()`.
 *
 * @name pianoroll
 * @synonyms punchcard
 * @tags visualization
 * @param {Object} options Object containing all the optional following parameters as key value pairs:
 * @param {integer} cycles number of cycles to be displayed at the same time - defaults to 4
 * @param {number} playhead location of the active notes on the time axis - 0 to 1, defaults to 0.5
 * @param {boolean} vertical displays the roll vertically - 0 by default
 * @param {boolean} labels displays labels on individual notes (see the label function) - 0 by default
 * @param {boolean} flipTime reverse the direction of the roll - 0 by default
 * @param {boolean} flipValues reverse the relative location of notes on the value axis - 0 by default
 * @param {number} overscan lookup X cycles outside of the cycles window to display notes in advance - 1 by default
 * @param {boolean} hideNegative hide notes with negative time (before starting playing the pattern) - 0 by default
 * @param {boolean} smear notes leave a solid trace - 0 by default
 * @param {boolean} fold notes takes the full value axis width - 0 by default
 * @param {string} active hexadecimal or CSS color of the active notes - defaults to #FFCA28
 * @param {string} inactive hexadecimal or CSS color of the inactive notes - defaults to #7491D2
 * @param {string} background hexadecimal or CSS color of the background - defaults to transparent
 * @param {string} playheadColor hexadecimal or CSS color of the line representing the play head - defaults to white
 * @param {boolean} fill notes are filled with color (otherwise only the label is displayed) - 0 by default
 * @param {boolean} fillActive active notes are filled with color - 0 by default
 * @param {boolean} stroke notes are shown with colored borders - 0 by default
 * @param {boolean} strokeActive active notes are shown with colored borders - 0 by default
 * @param {boolean} hideInactive only active notes are shown - 0 by default
 * @param {boolean} colorizeInactive use note color for inactive notes - 1 by default
 * @param {string} fontFamily define the font used by notes labels - defaults to 'monospace'
 * @param {integer} minMidi minimum note value to display on the value axis - defaults to 10
 * @param {integer} maxMidi maximum note value to display on the value axis - defaults to 90
 * @param {boolean} autorange automatically calculate the minMidi and maxMidi parameters - 0 by default
 * @see _pianoroll
 * @example
 * note("c2 a2 eb2")
 * .euclid(5,8)
 * .s('sawtooth')
 * .lpenv(4).lpf(300)
 * .pianoroll({ labels: 1 })
 */

Pattern.prototype.pianoroll = function (options = {}) {
  let { cycles = 4, playhead = 0.5, overscan = 0, hideNegative = false, ctx = getDrawContext(), id = 1 } = options;

  let from = -cycles * playhead;
  let to = cycles * (1 - playhead);
  const inFrame = (hap, t) => (!hideNegative || hap.whole.begin >= 0) && hap.isWithinTime(t + from, t + to);
  this.draw(
    (haps, time) => {
      __pianoroll({
        ...options,
        time,
        ctx,
        haps: haps.filter((hap) => inFrame(hap, time)),
      });
    },
    {
      lookbehind: from - overscan,
      lookahead: to + overscan,
      id,
    },
  );
  return this;
};

export function pianoroll(arg) {
  if (isPattern(arg)) {
    // Single argument as a pattern
    // (to support `all(pianoroll)`)
    return arg.pianoroll();
  }
  // Single argument with option - return function to get the pattern
  // (to support `all(pianoroll(options))`)
  return (pat) => pat.pianoroll(arg);
}

export function __pianoroll({
  time,
  haps,
  cycles = 4,
  playhead = 0.5,
  flipTime = 0,
  flipValues = 0,
  hideNegative = false,
  inactive = getTheme().foreground,
  active = getTheme().foreground,
  background = 'transparent',
  smear = 0,
  playheadColor = getTheme().foreground,
  minMidi = 10,
  maxMidi = 90,
  autorange = 0,
  timeframe: timeframeProp,
  fold = 1,
  vertical = 0,
  labels = false,
  tileLabels,
  fill = 1,
  fillActive = false,
  strokeActive = true,
  stroke,
  hideInactive = 0,
  colorizeInactive = 1,
  fontFamily,
  rowHeight = 0,
  playheadWidth = 1,
  foldValues: foldValuesPreset,
  preloadLanes = 0,
  lanePad = 2,
  laneGutterWidth = 0,
  laneFadeWidth = 0,
  laneLabelWidth = 0,
  laneLabels = false,
  laneLabelBg = '#1a1a1a',
  laneLabelSourceColor = '#808080',
  laneLabelNoteColor = '#e8e8ec',
  ctx,
  id,
} = {}) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  let from = -cycles * playhead;
  let to = cycles * (1 - playhead);

  if (id) {
    haps = haps.filter((hap) => hap.hasTag(id));
  }

  if (timeframeProp) {
    console.warn('timeframe is deprecated! use from/to instead');
    from = 0;
    to = timeframeProp;
  }
  const timeAxis = vertical ? h : w;
  const valueAxis = vertical ? w : h;
  let timeRange = vertical ? [timeAxis, 0] : [0, timeAxis]; // pixel range for time
  const timeExtent = to - from; // number of seconds that fit inside the canvas frame
  const valueRange = vertical ? [0, valueAxis] : [valueAxis, 0]; // pixel range for values
  let valueExtent = maxMidi - minMidi + 1; // number of "slots" for values, overwritten if autorange true
  let barThickness = valueAxis / valueExtent; // pixels per value, overwritten if autorange true
  flipTime && timeRange.reverse();
  flipValues && valueRange.reverse();

  // onQuery
  const { min, max, values } = haps.reduce(
    ({ min, max, values }, e) => {
      const v = getLaneKey(e);
      return {
        min: v < min ? v : min,
        max: v > max ? v : max,
        values: values.includes(v) ? values : [...values, v],
      };
    },
    { min: Infinity, max: -Infinity, values: [] },
  );
  if (autorange) {
    minMidi = min;
    maxMidi = max;
    valueExtent = maxMidi - minMidi + 1;
  }
  let foldValues = foldValuesPreset?.length
    ? sortLaneValues(foldValuesPreset)
    : sortLaneValues(values);
  const showTileLabels = tileLabels ?? labels;
  const tileLabelDraws = [];
  const laneInset = laneGutterWidth || laneLabelWidth;
  if (rowHeight > 0) {
    barThickness = rowHeight;
  } else {
    barThickness = fold ? valueAxis / foldValues.length : valueAxis / valueExtent;
  }
  if (rowHeight > 0 && foldValues.length) {
    const neededHeight = foldValues.length * barThickness + 2;
    ctx.canvas.height = neededHeight;
  }
  ctx.fillStyle = background;
  ctx.globalAlpha = 1; // reset!
  if (!smear) {
    ctx.clearRect(0, 0, w, h);
    if (background && background !== 'transparent') {
      ctx.fillRect(0, 0, w, h);
    }
  }
  if (preloadLanes && rowHeight > 0 && fold) {
    foldValues.forEach((laneValue, rowIndex) => {
      const laneY = flipValues ? ctx.canvas.height - (rowIndex + 1) * barThickness : rowIndex * barThickness;
      ctx.fillStyle = laneStripeColor(rowIndex);
      ctx.fillRect(0, laneY, w, barThickness);
    });
    if (laneGutterWidth > 0) {
      paintLaneGutterOverlay(ctx, foldValues, barThickness, flipValues, {
        laneGutterWidth,
        laneFadeWidth,
        laneLabels,
        fontFamily,
        laneLabelBg,
        laneLabelSourceColor,
        laneLabelNoteColor,
        paintFade: false,
      });
    }
  }
  haps.forEach((event) => {
    const isActive = event.whole.begin <= time && event.endClipped > time;
    let strokeCurrent = stroke ?? (strokeActive && isActive);
    let fillCurrent = (!isActive && fill) || (isActive && fillActive);
    if (hideInactive && !isActive) {
      return;
    }
    let color = event.value?.color;
    active = color || active;
    inactive = colorizeInactive ? color || inactive : inactive;
    color = isActive ? active : inactive;
    ctx.fillStyle = fillCurrent ? color : 'transparent';
    ctx.strokeStyle = color;
    const { velocity = 1, gain = 1 } = event.value || {};
    ctx.globalAlpha = velocity * gain;
    const timeProgress = (event.whole.begin - (flipTime ? to : from)) / timeExtent;
    const timePx = scale(timeProgress, ...timeRange);
    let durationPx = scale(event.duration / timeExtent, 0, timeAxis);
    const value = getLaneKey(event);
    let valuePx;
    if (rowHeight > 0 && fold) {
      const rowIndex = foldValues.indexOf(value);
      if (rowIndex < 0) {
        return;
      }
      valuePx = flipValues ? valueAxis - (rowIndex + 1) * barThickness : rowIndex * barThickness;
    } else {
      const valueProgress = fold
        ? foldValues.indexOf(value) / foldValues.length
        : (Number(value) - minMidi) / valueExtent;
      valuePx = scale(valueProgress, ...valueRange);
    }
    let margin = 0;
    const offset = scale(time / timeExtent, ...timeRange);
    let coords;
    if (vertical) {
      coords = [
        valuePx + 1 - (flipValues ? barThickness : 0), // x
        timeAxis - offset + timePx + margin + 1 - (flipTime ? 0 : durationPx), // y
        barThickness - 2, // width
        durationPx - 2, // height
      ];
    } else {
      const tileY =
        rowHeight > 0 && fold
          ? valuePx + lanePad
          : valuePx + 1 - (flipValues ? 0 : barThickness);
      const tileH = rowHeight > 0 && fold ? barThickness - lanePad * 2 : barThickness - 2;
      let tileX = timePx - offset + margin + 1 - (flipTime ? durationPx : 0);
      let tileW = durationPx - 2;
      if (laneInset > 0 && tileX < laneInset) {
        const clip = laneInset - tileX;
        tileX = laneInset;
        tileW = Math.max(0, tileW - clip);
      }
      if (tileW <= 0) {
        return;
      }
      coords = [tileX, tileY, tileW, tileH];
    }
    /* const xFactor = Math.sin(performance.now() / 500) + 1;
      coords[0] *= xFactor; */

    if (strokeCurrent) {
      ctx.strokeRect(...coords);
    }
    if (fillCurrent) {
      ctx.fillRect(...coords);
    }
    if (showTileLabels) {
      tileLabelDraws.push({
        label: tileLabelFromEvent(event, isActive),
        coords,
        fillCurrent,
      });
    }
  });
  if (preloadLanes && rowHeight > 0 && fold && laneGutterWidth > 0) {
    paintLaneGutterOverlay(ctx, foldValues, barThickness, flipValues, {
      laneGutterWidth,
      laneFadeWidth,
      laneLabels,
      fontFamily,
      laneLabelBg,
      laneLabelSourceColor,
      laneLabelNoteColor,
      paintFade: true,
    });
  }
  if (showTileLabels && tileLabelDraws.length) {
    paintTileLabels(ctx, tileLabelDraws, fontFamily, laneInset);
  }
  if (laneLabels && laneLabelWidth > 0 && !laneGutterWidth) {
    blitLaneLabelColumn(ctx, foldValues, barThickness, flipValues, laneLabelWidth, {
      fontFamily,
      laneLabelSourceColor,
      laneLabelNoteColor,
    });
  }
  ctx.globalAlpha = 1; // reset!
  const playheadPosition = scale(-from / timeExtent, ...timeRange);
  const playheadSpan = vertical ? w : ctx.canvas.height;
  ctx.strokeStyle = playheadColor;
  ctx.lineWidth = playheadWidth;
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(0, playheadPosition);
    ctx.lineTo(playheadSpan, playheadPosition);
  } else {
    ctx.moveTo(playheadPosition, 0);
    ctx.lineTo(playheadPosition, playheadSpan);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  return this;
}

export function getDrawOptions(drawTime, options = {}) {
  let [lookbehind, lookahead] = drawTime;
  lookbehind = Math.abs(lookbehind);
  const cycles = lookahead + lookbehind;
  const playhead = cycles !== 0 ? lookbehind / cycles : 0;
  return { fold: 1, ...options, cycles, playhead };
}

export const getPunchcardPainter =
  (options = {}) =>
  (ctx, time, haps, drawTime) =>
    __pianoroll({ ctx, time, haps, ...getDrawOptions(drawTime, options) });

Pattern.prototype.punchcard = function (options) {
  return this.onPaint(getPunchcardPainter(options));
};

/**
 * Displays a vertical pianoroll with event labels.
 * Supports all the same options as pianoroll.
 *
 * @name wordfall
 * @tags visualization
 */
Pattern.prototype.wordfall = function (options) {
  return this.punchcard({ vertical: 1, labels: 1, stroke: 0, fillActive: 1, active: 'white', ...options });
};

/* Pattern.prototype.pianoroll = function (options) {
  return this.onPaint((ctx, time, haps, drawTime) =>
    pianoroll({ ctx, time, haps, ...getDrawOptions(drawTime, { fold: 0, ...options }) }),
  );
}; */

export function drawPianoroll(options) {
  const { drawTime, ...rest } = options;
  __pianoroll({ ...getDrawOptions(drawTime), ...rest });
}
