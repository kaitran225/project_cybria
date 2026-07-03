import type { PixelAssetDocument } from "@pixode/asset-core";
import type { PaletteCollection, SavedPalette } from "../../storage/index.js";
import { PalettePicker } from "./PalettePicker.js";

export function PalettePanel({
  document,
  activeColorId,
  palettes = [],
  collections = [],
  activePaletteId,
  collapsed = false,
  readOnly = false,
  subTab = "colors",
  onSubTabChange,
  onToggleCollapse,
  onChange,
  onSelectColor,
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
}: {
  document: PixelAssetDocument;
  activeColorId: number;
  palettes?: SavedPalette[];
  collections?: PaletteCollection[];
  activePaletteId?: string;
  collapsed?: boolean;
  readOnly?: boolean;
  subTab?: "colors" | "collections";
  onSubTabChange?: (tab: "colors" | "collections") => void;
  onToggleCollapse?: () => void;
  onChange: (doc: PixelAssetDocument) => void;
  onSelectColor: (colorId: number) => void;
  onSelectLibraryPalette?: (id: string) => void;
  onApplyPaletteToDocument?: (
    paletteId: string,
    mode: "replace" | "merge"
  ) => void;
  onUpdateLibraryPalette?: (palette: SavedPalette) => void;
  onSaveDocumentAsPalette?: (name: string) => void;
  onRenamePalette?: (id: string, name: string) => void;
  onDeletePalette?: (id: string) => void;
  onExportPalette?: (id: string) => void;
  onImportPalette?: (file: File) => void;
  onCreatePalette?: (name: string) => void;
  onMovePaletteToCollection?: (paletteId: string, collectionId: string) => void;
  onCreateCollection?: (name: string) => void;
  onRenameCollection?: (id: string, name: string) => void;
  onDeleteCollection?: (id: string) => void;
  onSelectCollection?: (id: string) => void;
  activeCollectionId?: string;
  onUndock?: () => void;
}) {
  return (
    <PalettePicker
      palettes={palettes}
      collections={collections}
      activePaletteId={activePaletteId}
      documentPalette={document.palette}
      activeColorId={activeColorId}
      collapsed={collapsed}
      readOnly={readOnly}
      subTab={subTab}
      onSubTabChange={onSubTabChange}
      onToggleCollapse={onToggleCollapse ?? (() => {})}
      onSelectColor={onSelectColor}
      onDocumentPaletteChange={(entries) =>
        onChange({ ...document, palette: entries })
      }
      onSelectLibraryPalette={onSelectLibraryPalette ?? (() => {})}
      onApplyPaletteToDocument={onApplyPaletteToDocument ?? (() => {})}
      onUpdateLibraryPalette={onUpdateLibraryPalette}
      onSaveDocumentAsPalette={onSaveDocumentAsPalette ?? (() => {})}
      onRenamePalette={onRenamePalette ?? (() => {})}
      onDeletePalette={onDeletePalette ?? (() => {})}
      onExportPalette={onExportPalette ?? (() => {})}
      onImportPalette={onImportPalette ?? (() => {})}
      onCreatePalette={onCreatePalette ?? (() => {})}
      onMovePaletteToCollection={onMovePaletteToCollection ?? (() => {})}
      onCreateCollection={onCreateCollection ?? (() => {})}
      onRenameCollection={onRenameCollection ?? (() => {})}
      onDeleteCollection={onDeleteCollection ?? (() => {})}
      onSelectCollection={onSelectCollection ?? (() => {})}
      activeCollectionId={activeCollectionId}
      onUndock={onUndock}
    />
  );
}
