import type { CanvasTool } from "../editor/types.js";

const BRUSH_TOOLS: CanvasTool[] = ["pen", "erase", "mirror"];

export function ToolOptionsPanel({
  activeTool,
  brushSize,
  onBrushSizeChange,
  referenceGhostEnabled,
  onReferenceGhostToggle,
  referenceGhostOpacity,
  onReferenceGhostOpacityChange,
  variant = "panel",
}: {
  activeTool: CanvasTool;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  referenceGhostEnabled: boolean;
  onReferenceGhostToggle: (enabled: boolean) => void;
  referenceGhostOpacity: number;
  onReferenceGhostOpacityChange: (opacity: number) => void;
  variant?: "panel" | "toolbar";
}) {
  const showBrush = BRUSH_TOOLS.includes(activeTool);
  const toolbar = variant === "toolbar";

  return (
    <div className={`canvas-tool-options${toolbar ? " canvas-tool-options--toolbar" : ""}`}>
      {showBrush && (
        <div className={`canvas-tool-option-row${toolbar ? " canvas-tool-option-row--inline" : ""}`}>
          <label className="canvas-tool-option-label" htmlFor="brush-size">
            Brush
          </label>
          <div className="canvas-tool-option-control">
            <input
              id="brush-size"
              type="range"
              min={1}
              max={8}
              step={1}
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            />
            <span className="canvas-tool-option-value">{brushSize}×{brushSize}</span>
          </div>
        </div>
      )}

      <div className={`canvas-tool-option-row${toolbar ? " canvas-tool-option-row--inline" : ""}`}>
        <label className="canvas-tool-option-label">
          <input
            type="checkbox"
            checked={referenceGhostEnabled}
            onChange={(e) => onReferenceGhostToggle(e.target.checked)}
          />
          Reference ghost
        </label>
      </div>

      {referenceGhostEnabled && (
        <div className={`canvas-tool-option-row${toolbar ? " canvas-tool-option-row--inline" : ""}`}>
          <label className="canvas-tool-option-label" htmlFor="ghost-opacity">
            Ghost opacity
          </label>
          <div className="canvas-tool-option-control">
            <input
              id="ghost-opacity"
              type="range"
              min={20}
              max={60}
              step={5}
              value={Math.round(referenceGhostOpacity * 100)}
              onChange={(e) =>
                onReferenceGhostOpacityChange(Number(e.target.value) / 100)
              }
            />
            <span className="canvas-tool-option-value">
              {Math.round(referenceGhostOpacity * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
