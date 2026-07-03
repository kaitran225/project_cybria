import { useCallback, useRef, type CSSProperties } from "react";

export function HslStepSlider({
  label,
  value,
  min,
  max,
  step,
  fineStep,
  unit = "",
  format,
  trackStyle,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fineStep?: number;
  unit?: string;
  format?: (v: number) => string;
  trackStyle?: CSSProperties;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : `${Math.round(value)}${unit}`;

  const setFromClientX = useCallback(
    (clientX: number, fine: boolean) => {
      const track = trackRef.current;
      if (!track || disabled) return;
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + t * (max - min);
      const snap = fine ? fineStep ?? step : step;
      const snapped = Math.round(raw / snap) * snap;
      onChange(Math.max(min, Math.min(max, snapped)));
    },
    [disabled, fineStep, max, min, onChange, step]
  );

  const nudge = (dir: -1 | 1, fine: boolean) => {
    const snap = fine ? fineStep ?? step : step;
    onChange(Math.max(min, Math.min(max, value + dir * snap)));
  };

  const startDrag = (e: React.PointerEvent) => {
    if (disabled) return;
    setFromClientX(e.clientX, e.shiftKey);
    const move = (ev: PointerEvent) => setFromClientX(ev.clientX, ev.shiftKey);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className={`hsl-step-slider${disabled ? " disabled" : ""}`}>
      <div className="hsl-step-slider-head">
        <span className="hsl-step-slider-label">{label}</span>
        <span className="hsl-step-slider-value">{display}</span>
      </div>
      <div className="hsl-step-slider-row">
        <button
          type="button"
          className="hsl-step-slider-btn"
          onClick={() => nudge(-1, false)}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <div
          ref={trackRef}
          className="hsl-step-slider-track"
          style={trackStyle}
          onPointerDown={startDrag}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              nudge(-1, e.shiftKey);
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              nudge(1, e.shiftKey);
            }
          }}
        >
          <span className="hsl-step-slider-fill" style={{ width: `${pct}%` }} />
          <span className="hsl-step-slider-thumb" style={{ left: `${pct}%` }} />
        </div>
        <button
          type="button"
          className="hsl-step-slider-btn"
          onClick={() => nudge(1, false)}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
