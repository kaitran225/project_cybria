import type { PixelAssetDocument } from "@pixode/asset-core";
import {
  addAnimationFrameFromLast,
  addAnimationState,
  deleteAnimationFrame,
  ensureDocumentAnimations,
} from "../editor/animation-ops.js";
import { FrameThumbnail } from "./FrameThumbnail.js";

function CanvasControlIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="currentColor">
      {children}
    </svg>
  );
}

function PlayIcon() {
  return (
    <CanvasControlIcon>
      <path d="M6 4.5v7l5-3.5-5-3.5Z" />
    </CanvasControlIcon>
  );
}

function PauseIcon() {
  return (
    <CanvasControlIcon>
      <rect x="5" y="4.5" width="2.5" height="7" rx="0.5" />
      <rect x="8.5" y="4.5" width="2.5" height="7" rx="0.5" />
    </CanvasControlIcon>
  );
}

function StopIcon() {
  return (
    <CanvasControlIcon>
      <rect x="5" y="5" width="6" height="6" rx="0.75" />
    </CanvasControlIcon>
  );
}

function resolveAnim(document: PixelAssetDocument, activeAnimationId: string) {
  const states = document.animations?.states ?? [];
  if (states.length === 0) return null;
  return states.find((s) => s.id === activeAnimationId) ?? states[0];
}

export function AnimationTimeline({
  document,
  activeAnimationId,
  activeFrameIndex,
  onChange,
  onSelectFrame,
  playing = false,
  onPlay,
  onPause,
  onStop,
  fps = 8,
  onFpsChange,
  onionSkinEnabled = false,
  onOnionSkinToggle,
}: {
  document: PixelAssetDocument;
  activeAnimationId: string;
  activeFrameIndex: number;
  onChange: (doc: PixelAssetDocument) => void;
  onSelectFrame: (
    animId: string,
    frameIndex: number,
    doc?: PixelAssetDocument
  ) => void;
  playing?: boolean;
  onPause?: () => void;
  onPlay?: () => void;
  onStop?: () => void;
  fps?: number;
  onFpsChange?: (fps: number) => void;
  onionSkinEnabled?: boolean;
  onOnionSkinToggle?: () => void;
}) {
  const states = document.animations?.states ?? [];
  const anim = resolveAnim(document, activeAnimationId);
  const animId = anim?.id ?? activeAnimationId;

  const handleAddAnim = () => {
    const id = `anim_${states.length + 1}`;
    const next = addAnimationState(document, id, `Animation ${states.length + 1}`);
    onChange(next);
    onSelectFrame(id, 0);
  };

  const handleInitAnimation = () => {
    const next = ensureDocumentAnimations(document);
    onChange(next);
    const first = next.animations?.states[0];
    if (first) onSelectFrame(first.id, 0);
  };

  const handleAddFrame = () => {
    if (!anim) return;
    const insertAt = anim.frames.length - 1;
    const next = addAnimationFrameFromLast(document, animId);
    onChange(next);
    onSelectFrame(animId, insertAt + 1, next);
  };

  if (!anim || anim.frames.length === 0) {
    return (
      <div className="canvas-timeline">
        <button type="button" className="canvas-panel-btn" onClick={handleInitAnimation}>
          + Animation
        </button>
      </div>
    );
  }

  const safeFrameIndex = Math.min(activeFrameIndex, anim.frames.length - 1);

  return (
    <div className="canvas-timeline">
      <div className="canvas-timeline-header">
        <select
          className="canvas-timeline-anim-select"
          value={animId}
          onChange={(e) => onSelectFrame(e.target.value, 0)}
          aria-label="Animation"
        >
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.id}
            </option>
          ))}
        </select>

        {onPlay && onPause && onStop && (
          <div className="canvas-timeline-playback">
            {!playing ? (
              <button type="button" className="canvas-panel-btn canvas-panel-btn--icon" onClick={onPlay} title="Play">
                <PlayIcon />
              </button>
            ) : (
              <button type="button" className="canvas-panel-btn canvas-panel-btn--icon" onClick={onPause} title="Pause">
                <PauseIcon />
              </button>
            )}
            <button type="button" className="canvas-panel-btn canvas-panel-btn--icon" onClick={onStop} title="Stop">
              <StopIcon />
            </button>
            {onFpsChange && (
              <select
                className="canvas-timeline-fps"
                value={fps}
                onChange={(e) => onFpsChange(Number(e.target.value))}
                aria-label="FPS"
              >
                {[6, 8, 12, 24].map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {onOnionSkinToggle && (
          <label className="canvas-timeline-onion">
            <input
              type="checkbox"
              checked={onionSkinEnabled}
              onChange={onOnionSkinToggle}
            />
            Onion
          </label>
        )}

        <div className="canvas-timeline-actions">
          <span className="canvas-timeline-frame-label">
            Frame {safeFrameIndex + 1}/{anim.frames.length}
          </span>
          <button
            type="button"
            className="canvas-panel-btn small"
            onClick={handleAddFrame}
            title="Duplicate last frame"
          >
            + Frame
          </button>
          <button
            type="button"
            className="canvas-panel-btn small"
            disabled={anim.frames.length <= 1}
            onClick={() => {
              onChange(deleteAnimationFrame(document, animId, safeFrameIndex));
              onSelectFrame(
                animId,
                Math.max(0, Math.min(safeFrameIndex, anim.frames.length - 2))
              );
            }}
            title="Delete frame"
          >
            -
          </button>
          <button
            type="button"
            className="canvas-panel-btn small"
            onClick={handleAddAnim}
            title="New animation"
          >
            + Anim
          </button>
        </div>
      </div>

      <div className="canvas-timeline-frames">
        {anim.frames.map((frame, i) => (
          <FrameThumbnail
            key={`${animId}-${i}-${frame.layerIds.join(",")}`}
            document={document}
            animId={animId}
            frameIndex={i}
            active={i === safeFrameIndex}
            onClick={() => onSelectFrame(animId, i)}
            label={`${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
