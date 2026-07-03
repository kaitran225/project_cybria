import { useCallback, useEffect, useRef, useState } from "react";
import { buildColorGrid } from "../editor/color-grid.js";
import {
  hexToHsl,
  hexToRgb,
  hslToHex,
  normalizeHex,
  rgbToHex,
} from "../editor/color-utils.js";
import { HslStepSlider } from "./HslStepSlider.js";

type PickerTab = "grid" | "spectrum" | "sliders";

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

const GRID_COLS = 20;
const GRID_COLOR_ROWS = 14;
const COLOR_GRID = buildColorGrid(GRID_COLS, GRID_COLOR_ROWS);

function ColorGrid({
  hex,
  onChange,
  disabled,
}: {
  hex: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="color-picker-grid"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
    >
      {COLOR_GRID.flat().map((cell, i) => (
        <button
          key={i}
          type="button"
          className={`color-picker-grid-cell${cell === hex ? " active" : ""}`}
          style={{ background: cell }}
          disabled={disabled}
          onClick={() => onChange(cell)}
          aria-label={cell}
        />
      ))}
    </div>
  );
}

function ColorSpectrum({
  hex,
  onChange,
  disabled,
}: {
  hex: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const { r, g, b } = hexToRgb(hex);
  const [hsv, setHsv] = useState(() => rgbToHsv(r, g, b));

  useEffect(() => {
    const n = normalizeHex(hex);
    if (!n) return;
    const rgb = hexToRgb(n);
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
  }, [hex]);

  const emitHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      setHsv(next);
      const rgb = hsvToRgb(next.h, next.s, next.v);
      onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
    },
    [onChange]
  );

  const drawSv = useCallback(() => {
    const canvas = svRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const hueRgb = hsvToRgb(hsv.h, 1, 1);
    const gradWhite = ctx.createLinearGradient(0, 0, w, 0);
    gradWhite.addColorStop(0, "#ffffff");
    gradWhite.addColorStop(1, rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b));
    ctx.fillStyle = gradWhite;
    ctx.fillRect(0, 0, w, h);
    const gradBlack = ctx.createLinearGradient(0, 0, 0, h);
    gradBlack.addColorStop(0, "rgba(0,0,0,0)");
    gradBlack.addColorStop(1, "#000000");
    ctx.fillStyle = gradBlack;
    ctx.fillRect(0, 0, w, h);
  }, [hsv.h]);

  const drawHue = useCallback(() => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 6; i++) {
      const rgb = hsvToRgb(i * 60, 1, 1);
      grad.addColorStop(i / 6, rgbToHex(rgb.r, rgb.g, rgb.b));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, h);
  }, []);

  useEffect(() => {
    drawSv();
    drawHue();
  }, [drawSv, drawHue]);

  const startDrag = (
    e: React.PointerEvent,
    handler: (cx: number, cy: number) => void
  ) => {
    if (disabled) return;
    handler(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => handler(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleSv = (clientX: number, clientY: number) => {
    const canvas = svRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    emitHsv({ h: hsv.h, s: x, v: 1 - y });
  };

  const handleHue = (_: number, clientY: number) => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    emitHsv({ h: y * 360, s: hsv.s, v: hsv.v });
  };

  return (
    <div className={`color-picker-spectrum${disabled ? " disabled" : ""}`}>
      <div className="color-picker-spectrum-body">
        <div className="color-picker-sv-wrap">
          <canvas
            ref={svRef}
            width={200}
            height={140}
            className="color-picker-sv"
            onPointerDown={(e) => startDrag(e, handleSv)}
          />
          <span
            className="color-picker-sv-cursor"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          />
        </div>
        <div className="color-picker-hue-wrap">
          <canvas
            ref={hueRef}
            width={14}
            height={140}
            className="color-picker-hue"
            onPointerDown={(e) => startDrag(e, handleHue)}
          />
          <span
            className="color-picker-hue-cursor"
            style={{ top: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ColorSliders({
  hex,
  onChange,
  disabled,
}: {
  hex: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [hsl, setHsl] = useState(() => hexToHsl(hex));

  useEffect(() => {
    const n = normalizeHex(hex);
    if (n) setHsl(hexToHsl(n));
  }, [hex]);

  const emitHsl = (next: { h: number; s: number; l: number }) => {
    setHsl(next);
    onChange(hslToHex(next.h, next.s, next.l));
  };

  const satMid = hslToHex(hsl.h, 50, hsl.l);
  const satFull = hslToHex(hsl.h, 100, hsl.l);

  return (
    <div className={`color-picker-sliders${disabled ? " disabled" : ""}`}>
      <HslStepSlider
        label="Hue"
        value={hsl.h}
        min={0}
        max={360}
        step={1}
        fineStep={1}
        format={(v) => `${Math.round(v)}°`}
        trackStyle={{
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onChange={(h) => emitHsl({ ...hsl, h })}
        disabled={disabled}
      />
      <HslStepSlider
        label="Saturation"
        value={hsl.s}
        min={0}
        max={100}
        step={1}
        fineStep={1}
        format={(v) => `${Math.round(v)}%`}
        trackStyle={{
          background: `linear-gradient(to right, hsl(${hsl.h} 0% ${hsl.l}%), ${satFull})`,
        }}
        onChange={(s) => emitHsl({ ...hsl, s })}
        disabled={disabled}
      />
      <HslStepSlider
        label="Luminance"
        value={hsl.l}
        min={0}
        max={100}
        step={1}
        fineStep={1}
        format={(v) => `${Math.round(v)}%`}
        trackStyle={{
          background: `linear-gradient(to right, #000, ${satMid}, #fff)`,
        }}
        onChange={(l) => emitHsl({ ...hsl, l })}
        disabled={disabled}
      />
    </div>
  );
}

export function ColorPicker({
  hex,
  onChange,
  disabled = false,
  documentSwatches,
  onSelectSwatch,
  onCopyHex,
}: {
  hex: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  documentSwatches?: { id: number; hex: string }[];
  onSelectSwatch?: (id: number) => void;
  onCopyHex?: (hex: string) => void;
}) {
  const [tab, setTab] = useState<PickerTab>("grid");
  const [hexInput, setHexInput] = useState(hex);
  const hsl = hexToHsl(hex);

  useEffect(() => {
    const n = normalizeHex(hex);
    if (n) setHexInput(n);
  }, [hex]);

  const handleHexBlur = () => {
    const n = normalizeHex(hexInput);
    if (!n) {
      setHexInput(hex);
      return;
    }
    onChange(n);
  };

  return (
    <div className={`color-picker${disabled ? " disabled" : ""}`}>
      <div className="color-picker-tabs" role="tablist">
        {(["grid", "spectrum", "sliders"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`color-picker-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "grid" ? "Grid" : t === "spectrum" ? "Spectrum" : "Sliders"}
          </button>
        ))}
      </div>

      <div className="color-picker-panel" role="tabpanel">
        {tab === "grid" && (
          <ColorGrid hex={hex} onChange={onChange} disabled={disabled} />
        )}
        {tab === "spectrum" && (
          <ColorSpectrum hex={hex} onChange={onChange} disabled={disabled} />
        )}
        {tab === "sliders" && (
          <ColorSliders hex={hex} onChange={onChange} disabled={disabled} />
        )}
      </div>

      <div className="color-picker-footer">
        <button
          type="button"
          className="color-picker-preview"
          style={{ background: hex }}
          title={`${hex} — click to copy`}
          aria-label={`Copy ${hex}`}
          disabled={disabled}
          onClick={() => onCopyHex?.(hex)}
        />
        <div className="color-picker-footer-meta">
          <input
            className="color-picker-hex"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={handleHexBlur}
            onKeyDown={(e) => e.key === "Enter" && handleHexBlur()}
            disabled={disabled}
            spellCheck={false}
            aria-label="Hex color"
          />
          <span className="color-picker-hsl-readout">
            H{Math.round(hsl.h)} S{Math.round(hsl.s)} L{Math.round(hsl.l)}
          </span>
        </div>
      </div>

      {documentSwatches && documentSwatches.length > 0 && (
        <div className="color-picker-doc-swatches" role="listbox" aria-label="Document palette">
          {documentSwatches.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              className={`color-picker-doc-swatch${s.hex === hex ? " active" : ""}`}
              style={{ background: s.hex }}
              onClick={() => {
                onChange(s.hex);
                onSelectSwatch?.(s.id);
              }}
              title={`${s.hex} (click swatch, double-click copies)`}
              onDoubleClick={() => onCopyHex?.(s.hex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
