import { useCallback, useEffect, useRef, useState } from "react";
import { ApplyPalettePrompt } from "./ApplyPalettePrompt.js";
import type { PaletteEntry } from "@pixode/asset-core";
import type { PaletteCollection, SavedPalette } from "../../storage/index.js";
import { ColorPicker } from "./ColorPicker.js";
import { OverflowMenu } from "./OverflowMenu.js";
import { PaletteCollectionsPanel } from "./PaletteCollectionsPanel.js";

function PaletteToolIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3">
      {children}
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <PaletteToolIcon>
      <rect x="5.5" y="2.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="4.5" width="7" height="7" rx="1" fill="var(--surface-2)" />
    </PaletteToolIcon>
  );
}

function ChevronIcon({ direction }: { direction: "right" | "down" }) {
  return (
    <PaletteToolIcon strokeLinecap="round" strokeLinejoin="round">
      {direction === "right" ? (
        <path d="M6 4.5l4 3.5-4 3.5" />
      ) : (
        <path d="M4.5 6l3.5 4 3.5-4" />
      )}
    </PaletteToolIcon>
  );
}

export function PalettePicker({
  palettes,
  collections,
  activePaletteId,
  documentPalette,
  activeColorId,
  collapsed,
  readOnly = false,
  subTab = "colors",
  onSubTabChange,
  onToggleCollapse,
  onSelectColor,
  onDocumentPaletteChange,
  onSelectLibraryPalette,
  onApplyPaletteToDocument,
  onUpdateLibraryPalette,
  onSaveDocumentAsPalette,
  onRenamePalette,
  onDeletePalette,
  onExportPalette,
  onImportPalette,
  onCreatePalette,
  onMovePaletteToCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onSelectCollection,
  activeCollectionId,
  onUndock,
  docked = true,
}: {
  palettes: SavedPalette[];
  collections: PaletteCollection[];
  activePaletteId?: string;
  documentPalette: PaletteEntry[];
  activeColorId: number;
  collapsed: boolean;
  readOnly?: boolean;
  subTab?: "colors" | "collections";
  onSubTabChange?: (tab: "colors" | "collections") => void;
  onToggleCollapse: () => void;
  onSelectColor: (colorId: number) => void;
  onDocumentPaletteChange: (entries: PaletteEntry[]) => void;
  onSelectLibraryPalette: (id: string) => void;
  onApplyPaletteToDocument: (
    paletteId: string,
    mode: "replace" | "merge"
  ) => void;
  onUpdateLibraryPalette?: (palette: SavedPalette) => void;
  onSaveDocumentAsPalette: (name: string) => void;
  onRenamePalette: (id: string, name: string) => void;
  onDeletePalette: (id: string) => void;
  onExportPalette: (id: string) => void;
  onImportPalette: (file: File) => void;
  onCreatePalette: (name: string) => void;
  onMovePaletteToCollection: (paletteId: string, collectionId: string) => void;
  onCreateCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onSelectCollection: (id: string) => void;
  activeCollectionId?: string;
  onUndock?: () => void;
  docked?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [applyTargetId, setApplyTargetId] = useState<string | null>(null);
  const [editingLibrary, setEditingLibrary] = useState(false);
  const [libraryColorIdx, setLibraryColorIdx] = useState(0);
  const showCollections = subTab === "collections";
  const libraryPalette = palettes.find((p) => p.id === activePaletteId);

  const activeEntry =
    documentPalette.find((e) => e.id === activeColorId) ?? documentPalette[0];
  const libraryColor = libraryPalette?.colors[libraryColorIdx];

  const copyHex = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!collapsed) return;
    const el = stripRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body && !el.contains(e.target as Node)) return;
      const idx = documentPalette.findIndex((e) => e.id === activeColorId);
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        onSelectColor(documentPalette[idx - 1].id);
      } else if (e.key === "ArrowRight" && idx < documentPalette.length - 1) {
        e.preventDefault();
        onSelectColor(documentPalette[idx + 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, documentPalette, activeColorId, onSelectColor]);

  const updateActiveHex = (hex: string) => {
    if (!activeEntry || readOnly) return;
    onDocumentPaletteChange(
      documentPalette.map((e) =>
        e.id === activeEntry.id ? { ...e, hex } : e
      )
    );
  };

  const addColor = () => {
    const id = Math.max(-1, ...documentPalette.map((p) => p.id)) + 1;
    onDocumentPaletteChange([
      ...documentPalette,
      { id, hex: activeEntry?.hex ?? "#95e1d3" },
    ]);
    onSelectColor(id);
  };

  const duplicateColor = () => {
    if (!activeEntry || readOnly) return;
    const id = Math.max(-1, ...documentPalette.map((p) => p.id)) + 1;
    onDocumentPaletteChange([
      ...documentPalette,
      { id, hex: activeEntry.hex, role: activeEntry.role },
    ]);
    onSelectColor(id);
  };

  const deleteColor = () => {
    if (!activeEntry || readOnly || documentPalette.length <= 1) return;
    const idx = documentPalette.findIndex((e) => e.id === activeEntry.id);
    const next = documentPalette.filter((e) => e.id !== activeEntry.id);
    onDocumentPaletteChange(next);
    onSelectColor(next[Math.max(0, idx - 1)].id);
  };

  const libraryMenu = (
    <>
      <label className="overflow-menu-field">
        <span>Library palette</span>
        <select
          value={activePaletteId ?? ""}
          onChange={(e) => {
            if (e.target.value) onSelectLibraryPalette(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Document only</option>
          {palettes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {!readOnly && (
        <>
          <button
            type="button"
            disabled={!activePaletteId}
            onClick={() => activePaletteId && setApplyTargetId(activePaletteId)}
          >
            Apply to document…
          </button>
          {activePaletteId && libraryPalette && onUpdateLibraryPalette && (
            <button
              type="button"
              onClick={() => {
                setEditingLibrary((v) => !v);
                setLibraryColorIdx(0);
              }}
            >
              {editingLibrary ? "Edit document colors" : "Edit library colors"}
            </button>
          )}
          <button type="button" onClick={() => setShowSaveInput(true)}>
            Save document as palette…
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Import .pixpalette
          </button>
          <button
            type="button"
            disabled={!activePaletteId}
            onClick={() => activePaletteId && onExportPalette(activePaletteId)}
          >
            Export library palette
          </button>
          {activePaletteId && libraryPalette && (
            <>
              <div className="overflow-menu-divider" />
              <button
                type="button"
                className="overflow-menu-danger"
                onClick={() => onDeletePalette(activePaletteId)}
              >
                Delete "{libraryPalette.name}"
              </button>
            </>
          )}
        </>
      )}
    </>
  );

  const overflowMenu = (
    <>
      <button
        type="button"
        onClick={() => onSubTabChange?.(showCollections ? "colors" : "collections")}
      >
        {showCollections ? "Back to colors" : "Collections…"}
      </button>
      {onUndock && docked && (
        <button type="button" onClick={onUndock}>
          Undock palette
        </button>
      )}
      {activePaletteId && libraryPalette && !readOnly && (
        <label className="overflow-menu-field">
          <span>Rename library</span>
          <input
            className="color-picker-hex"
            defaultValue={libraryPalette.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) =>
              onRenamePalette(
                activePaletteId,
                e.target.value.trim() || libraryPalette.name
              )
            }
          />
        </label>
      )}
    </>
  );

  const toolbar = (
    <div className="palette-studio-toolbar">
      {!readOnly && (
        <>
          <button type="button" className="palette-studio-tool" onClick={addColor} title="Add color">
            +
          </button>
          <button
            type="button"
            className="palette-studio-tool"
            onClick={duplicateColor}
            disabled={!activeEntry}
            title="Duplicate color"
          >
            <DuplicateIcon />
          </button>
          <button
            type="button"
            className="palette-studio-tool"
            onClick={deleteColor}
            disabled={documentPalette.length <= 1}
            title="Remove color"
          >
            -
          </button>
          <span className="palette-studio-toolbar-sep" />
        </>
      )}
      <OverflowMenu label="Lib" className="palette-studio-lib-menu" ariaLabel="Library palettes">
        {libraryMenu}
      </OverflowMenu>
      <OverflowMenu className="palette-studio-more-menu" ariaLabel="More palette options">
        {overflowMenu}
      </OverflowMenu>
    </div>
  );

  const hiddenFileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".json,.pixpalette.json"
      className="canvas-color-picker-native"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onImportPalette(file);
        e.target.value = "";
      }}
    />
  );

  const saveRow = showSaveInput && !readOnly && (
    <div className="palette-studio-save">
      <input
        className="color-picker-hex"
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
        placeholder="Palette name"
        autoFocus
      />
      <button
        type="button"
        className="canvas-panel-btn small"
        onClick={() => {
          if (saveName.trim()) {
            onSaveDocumentAsPalette(saveName.trim());
            setSaveName("");
            setShowSaveInput(false);
          }
        }}
      >
        Save
      </button>
      <button
        type="button"
        className="canvas-panel-btn small"
        onClick={() => setShowSaveInput(false)}
      >
        Cancel
      </button>
    </div>
  );

  const collapsedStrip = (
    <div
      ref={stripRef}
      className="palette-studio-strip"
      role="listbox"
      aria-label="Palette colors"
      tabIndex={0}
    >
      {documentPalette.map((entry, i) => (
        <button
          key={entry.id}
          type="button"
          role="option"
          aria-selected={entry.id === activeColorId}
          aria-label={`Color ${i + 1}: ${entry.hex}`}
          className={`palette-studio-slot${entry.id === activeColorId ? " active" : ""}`}
          onClick={() => onSelectColor(entry.id)}
          onDoubleClick={() => copyHex(entry.hex)}
          title={`${entry.hex} (double-click to copy)`}
        >
          <span className="palette-studio-slot-swatch" style={{ background: entry.hex }} />
        </button>
      ))}
      {!readOnly && (
        <button
          type="button"
          className="palette-studio-slot palette-studio-slot--add"
          onClick={addColor}
          title="Add color"
        >
          +
        </button>
      )}
    </div>
  );

  return (
    <section className={`palette-studio${collapsed ? " palette-studio--collapsed" : " palette-studio--expanded"}`}>
      <header className="palette-studio-header">
        <button
          type="button"
          className="palette-studio-toggle"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
        >
          <ChevronIcon direction={collapsed ? "right" : "down"} />
        </button>
        <span className="palette-studio-title">Palette</span>
        {activeEntry && (
          <span
            className="palette-studio-active-dot"
            style={{ background: activeEntry.hex }}
            title={activeEntry.hex}
          />
        )}
        {toolbar}
      </header>

      {hiddenFileInput}
      {saveRow}

      {collapsed ? (
        collapsedStrip
      ) : showCollections ? (
        <PaletteCollectionsPanel
          palettes={palettes}
          collections={collections}
          activeCollectionId={activeCollectionId}
          onMovePalette={onMovePaletteToCollection}
          onSelectPalette={onSelectLibraryPalette}
          onCreatePalette={onCreatePalette}
          onCreateCollection={onCreateCollection}
          onRenameCollection={onRenameCollection}
          onDeleteCollection={onDeleteCollection}
          onSelectCollection={onSelectCollection}
        />
      ) : editingLibrary && libraryPalette && libraryColor && onUpdateLibraryPalette ? (
        <>
          <div className="palette-studio-library-strip" role="listbox" aria-label="Library colors">
            {libraryPalette.colors.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === libraryColorIdx}
                className={`palette-studio-slot${i === libraryColorIdx ? " active" : ""}`}
                onClick={() => setLibraryColorIdx(i)}
                title={`${c.hex} (double-click to copy)`}
                onDoubleClick={() => copyHex(c.hex)}
              >
                <span
                  className="palette-studio-slot-swatch"
                  style={{ background: c.hex }}
                />
              </button>
            ))}
          </div>
          <ColorPicker
            hex={libraryColor.hex}
            onChange={(hex) => {
              const colors = libraryPalette.colors.map((c, i) =>
                i === libraryColorIdx ? { ...c, hex } : c
              );
              onUpdateLibraryPalette({ ...libraryPalette, colors });
            }}
            disabled={readOnly}
          />
        </>
      ) : (
        activeEntry && (
          <ColorPicker
            hex={activeEntry.hex}
            onChange={updateActiveHex}
            disabled={readOnly}
            documentSwatches={documentPalette.map((e) => ({ id: e.id, hex: e.hex }))}
            onSelectSwatch={onSelectColor}
            onCopyHex={copyHex}
          />
        )
      )}

      {applyTargetId && libraryPalette && (
        <ApplyPalettePrompt
          paletteName={libraryPalette.name}
          onCancel={() => setApplyTargetId(null)}
          onMerge={() => {
            onApplyPaletteToDocument(applyTargetId, "merge");
            setApplyTargetId(null);
          }}
          onReplace={() => {
            onApplyPaletteToDocument(applyTargetId, "replace");
            setApplyTargetId(null);
          }}
        />
      )}
    </section>
  );
}
