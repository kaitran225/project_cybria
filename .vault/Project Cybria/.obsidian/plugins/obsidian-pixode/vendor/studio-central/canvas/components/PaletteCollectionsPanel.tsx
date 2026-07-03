import { useState } from "react";
import type { PaletteCollection, SavedPalette } from "../../storage/index.js";

export function PaletteCollectionsPanel({
  palettes,
  collections,
  activeCollectionId,
  onMovePalette,
  onSelectPalette,
  onCreatePalette,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onSelectCollection,
}: {
  palettes: SavedPalette[];
  collections: PaletteCollection[];
  activeCollectionId?: string;
  onMovePalette: (paletteId: string, collectionId: string) => void;
  onSelectPalette: (id: string) => void;
  onCreatePalette: (name: string) => void;
  onCreateCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onSelectCollection: (id: string) => void;
}) {
  const [newCollectionName, setNewCollectionName] = useState("");

  return (
    <div className="canvas-palette-collections">
      <div className="canvas-palette-collections-toolbar">
        <input
          className="canvas-color-picker-hex"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="New collection name"
        />
        <button
          type="button"
          className="canvas-panel-btn small"
          onClick={() => {
            const name = newCollectionName.trim();
            if (!name) return;
            onCreateCollection(name);
            setNewCollectionName("");
          }}
        >
          + Collection
        </button>
      </div>
      {collections.map((col) => (
        <div
          key={col.id}
          className={`canvas-palette-collection${
            activeCollectionId === col.id ? " canvas-palette-collection--active" : ""
          }`}
        >
          <div className="canvas-palette-collection-header">
            <button
              type="button"
              className="canvas-palette-collection-select"
              onClick={() => onSelectCollection(col.id)}
            >
              {activeCollectionId === col.id ? "● " : ""}
            </button>
            <input
              className="canvas-palette-collection-name"
              defaultValue={col.name}
              onBlur={(e) =>
                onRenameCollection(col.id, e.target.value.trim() || col.name)
              }
              onClick={(e) => e.stopPropagation()}
            />
            {col.id !== "default" && (
              <button
                type="button"
                className="canvas-panel-btn small"
                title="Delete collection"
                onClick={() => {
                  if (window.confirm(`Delete collection "${col.name}"? Palettes move to Default.`)) {
                    onDeleteCollection(col.id);
                  }
                }}
              >
                ×
              </button>
            )}
          </div>
          <ul className="canvas-palette-collection-list">
            {col.paletteIds.map((pid) => {
              const p = palettes.find((x) => x.id === pid);
              if (!p) return null;
              return (
                <li key={pid}>
                  <button
                    type="button"
                    className="canvas-palette-collection-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-pixode-palette-id", pid);
                    }}
                    onClick={() => onSelectPalette(pid)}
                  >
                    <span
                      className="canvas-palette-swatch"
                      style={{ background: p.colors[0]?.hex ?? "#000" }}
                    />
                    {p.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            className="canvas-palette-collection-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const pid = e.dataTransfer.getData("application/x-pixode-palette-id");
              if (pid) onMovePalette(pid, col.id);
            }}
          >
            Drop palette here
          </div>
        </div>
      ))}
      <button
        type="button"
        className="canvas-panel-btn"
        onClick={() => onCreatePalette(`Palette ${palettes.length + 1}`)}
      >
        + New palette
      </button>
    </div>
  );
}
