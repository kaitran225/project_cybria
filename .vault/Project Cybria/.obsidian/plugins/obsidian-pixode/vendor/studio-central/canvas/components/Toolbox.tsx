import type { CanvasTool } from "../editor/types.js";

const TOOLS: { id: CanvasTool; label: string; icon: string }[] = [
  { id: "pen", label: "Pen", icon: "✎" },
  { id: "erase", label: "Erase", icon: "⌫" },
  { id: "fill", label: "Fill", icon: "▣" },
  { id: "picker", label: "Picker", icon: "◎" },
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "select", label: "Select", icon: "⬚" },
  { id: "move", label: "Move", icon: "✥" },
];

export function Toolbox({
  activeTool,
  mirrorEnabled,
  onToolChange,
  onMirrorToggle,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  variant = "dock",
}: {
  activeTool: CanvasTool;
  mirrorEnabled: boolean;
  onToolChange: (tool: CanvasTool) => void;
  onMirrorToggle: (enabled: boolean) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  variant?: "dock" | "bar" | "toolbar";
}) {
  if (variant === "toolbar") {
    return (
      <div className="canvas-toolbox canvas-toolbox--toolbar">
        {onUndo && (
          <button
            type="button"
            className="canvas-tool-btn canvas-tool-btn--dock"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            className="canvas-tool-btn canvas-tool-btn--dock"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
        )}
        <div className="canvas-tool-dock-sep canvas-tool-dock-sep--horizontal" />
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`canvas-tool-btn canvas-tool-btn--dock${
              activeTool === t.id ? " active" : ""
            }`}
            onClick={() => onToolChange(t.id)}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
        <button
          type="button"
          className={`canvas-tool-btn canvas-tool-btn--dock${
            mirrorEnabled ? " active" : ""
          }`}
          onClick={() => onMirrorToggle(!mirrorEnabled)}
          title="Mirror X"
        >
          ⟺
        </button>
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className="canvas-toolbox canvas-toolbox--bar">
        {onUndo && (
          <button type="button" className="canvas-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
            ↶
          </button>
        )}
        {onRedo && (
          <button type="button" className="canvas-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
            ↷
          </button>
        )}
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`canvas-tool-btn${activeTool === t.id ? " active" : ""}`}
            onClick={() => onToolChange(t.id)}
            title={t.label}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className={`canvas-tool-btn${mirrorEnabled ? " active" : ""}`}
          onClick={() => onMirrorToggle(!mirrorEnabled)}
          title="Mirror X"
        >
          ⟺
        </button>
      </div>
    );
  }

  return (
    <div className="canvas-toolbox canvas-toolbox--dock">
      {onUndo && (
        <button
          type="button"
          className="canvas-tool-btn canvas-tool-btn--dock"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
      )}
      {onRedo && (
        <button
          type="button"
          className="canvas-tool-btn canvas-tool-btn--dock"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
      )}
      <div className="canvas-tool-dock-sep" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`canvas-tool-btn canvas-tool-btn--dock${
            activeTool === t.id ? " active" : ""
          }`}
          onClick={() => onToolChange(t.id)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
      <button
        type="button"
        className={`canvas-tool-btn canvas-tool-btn--dock canvas-tool-btn--mirror${
          mirrorEnabled ? " active" : ""
        }`}
        onClick={() => onMirrorToggle(!mirrorEnabled)}
        title="Mirror X"
      >
        ⟺
      </button>
    </div>
  );
}
