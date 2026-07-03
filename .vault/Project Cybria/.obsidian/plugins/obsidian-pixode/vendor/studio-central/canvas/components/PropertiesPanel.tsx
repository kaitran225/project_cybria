import type { PixelAssetDocument } from "@pixode/asset-core";

export function PropertiesPanel({
  document,
  onChange,
  embedded = false,
}: {
  document: PixelAssetDocument;
  onChange: (doc: PixelAssetDocument) => void;
  embedded?: boolean;
}) {
  return (
    <div className={`canvas-properties-panel${embedded ? " canvas-properties-panel--embedded" : ""}`}>
      {!embedded && (
        <div className="canvas-panel-header">
          <span>Properties</span>
        </div>
      )}
      <div className="canvas-prop-row">
        <label>Name</label>
        <input
          className="canvas-prop-input"
          value={document.id}
          readOnly
        />
      </div>
      <div className="canvas-prop-row">
        <label>Canvas</label>
        <span className="canvas-prop-value">
          {document.canvas.width} × {document.canvas.height}
        </span>
      </div>
      <div className="canvas-prop-row">
        <label>Tags</label>
        <input
          className="canvas-prop-input"
          value={document.metadata.tags.join(", ")}
          onChange={(e) =>
            onChange({
              ...document,
              metadata: {
                ...document.metadata,
                tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
              },
            })
          }
        />
      </div>
    </div>
  );
}
