export function ApplyPalettePrompt({
  paletteName,
  onReplace,
  onMerge,
  onCancel,
}: {
  paletteName: string;
  onReplace: () => void;
  onMerge: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="studio-modal-backdrop" onClick={onCancel}>
      <div
        className="studio-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="apply-palette-title"
      >
        <h3 id="apply-palette-title">Apply “{paletteName}”</h3>
        <p className="studio-modal-desc">
          Replace swaps the document palette and remaps pixels by color. Merge adds
          missing library colors without changing existing swatches.
        </p>
        <div className="studio-modal-actions">
          <button type="button" className="canvas-panel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="canvas-panel-btn" onClick={onMerge}>
            Merge
          </button>
          <button type="button" className="canvas-panel-btn" onClick={onReplace}>
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
