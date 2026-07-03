import { createWavyRingScene } from '@src/repl/components/pianoroll/wavy-ring-scene.mjs';
import { useEffect, useRef } from 'react';

export function WavyRingVisualizer({ active = false, open = false }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const frameRef = useRef(0);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const scene = createWavyRingScene(host);
    sceneRef.current = scene;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      scene.resize(rect.width, rect.height);
    };

    const animate = (time) => {
      scene.tick(time, activeRef.current);
      frameRef.current = requestAnimationFrame(animate);
    };

    resize();
    frameRef.current = requestAnimationFrame(animate);
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [open]);

  return <div ref={hostRef} className="cote-repl-widget__webgl-host" aria-hidden />;
}
