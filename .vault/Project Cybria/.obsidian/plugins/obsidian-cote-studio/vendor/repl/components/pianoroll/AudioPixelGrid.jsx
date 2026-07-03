import { readAudioAnalyser, sampleMidiRangeEnergy } from '@src/repl/audio-analyser.mjs';
import { buildPixelGrid } from '@src/repl/components/pianoroll/audio-pixel.mjs';
import { useEffect, useRef } from 'react';

const GAP = 2;
const FPS_INTERVAL = 1000 / 60;
const MAX_TICKER = 360;
const ENERGY_THRESHOLD = 0.12;

export function AudioPixelGrid({ active = false, open = false }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const pixelsRef = useRef([]);
  const lastTimeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const activeRef = useRef(active);
  const tickerRef = useRef(0);
  const directionRef = useRef(1);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const rebuildGrid = (w, h) => {
      const ratio = window.devicePixelRatio || 1;
      const gap = Math.max(4, Math.floor(GAP * ratio));
      const { pixels } = buildPixelGrid(w, h, gap);
      pixelsRef.current = pixels;
      sizeRef.current = { w, h };
      tickerRef.current = 0;
      directionRef.current = 1;
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const layoutW = parent.clientWidth;
      const layoutH = parent.clientHeight;
      if (layoutW <= 0 || layoutH <= 0) {
        return;
      }
      const w = Math.max(1, Math.floor(layoutW * ratio));
      const h = Math.max(1, Math.floor(layoutH * ratio));
      if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
        canvas.width = w;
        canvas.height = h;
        rebuildGrid(w, h);
      }
    };

    const draw = (now) => {
      frameRef.current = requestAnimationFrame(draw);
      const diff = now - (lastTimeRef.current || 0);
      if (diff < FPS_INTERVAL) {
        return;
      }
      lastTimeRef.current = now - (diff % FPS_INTERVAL);

      resize();
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const { frequencies } = readAudioAnalyser();
      const pixels = pixelsRef.current;
      const isActive = activeRef.current;
      let ticker = tickerRef.current;
      let animationDirection = directionRef.current;

      if (ticker >= MAX_TICKER) {
        animationDirection = -1;
      } else if (ticker <= 0) {
        animationDirection = 1;
      }

      let allHidden = true;

      for (const pixel of pixels) {
        if (isActive) {
          const energy = sampleMidiRangeEnergy(pixel.noteMin, pixel.noteMax, frequencies);
          if (energy > ENERGY_THRESHOLD) {
            if (animationDirection > 0) {
              pixel.show();
            } else {
              pixel.hide();
            }
          } else {
            pixel.hide();
          }
        } else if (animationDirection > 0) {
          pixel.show();
        } else {
          pixel.hide();
          allHidden = allHidden && pixel.isHidden;
        }

        if (!pixel.isHidden) {
          pixel.draw(ctx);
        }
      }

      ticker += animationDirection;
      if (!isActive && animationDirection < 0 && allHidden) {
        ticker = 0;
      }

      tickerRef.current = ticker;
      directionRef.current = animationDirection;
    };

    resize();
    frameRef.current = requestAnimationFrame(draw);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      pixelsRef.current = [];
      sizeRef.current = { w: 0, h: 0 };
    };
  }, [open]);

  return <canvas ref={canvasRef} className="cote-repl-widget__canvas" aria-hidden />;
}
