import { OverflowMenu } from "./OverflowMenu.js";

export function SelectionBar({
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onFlipH,
  onFlipV,
  onClear,
  onSaveSnippet,
}: {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onClear: () => void;
  onSaveSnippet?: () => void;
}) {
  return (
    <div className="selection-bar" role="toolbar" aria-label="Selection">
      <button type="button" onClick={onCopy} title="Copy (Ctrl+C)">
        Copy
      </button>
      <button type="button" onClick={onCut} title="Cut (Ctrl+X)">
        Cut
      </button>
      <button type="button" onClick={onPaste} title="Paste (Ctrl+V)">
        Paste
      </button>
      <button type="button" onClick={onDelete} title="Delete">
        Del
      </button>
      <OverflowMenu className="selection-bar-overflow" ariaLabel="More selection actions">
        <button type="button" onClick={onFlipH}>
          Flip horizontal
        </button>
        <button type="button" onClick={onFlipV}>
          Flip vertical
        </button>
        {onSaveSnippet && (
          <button type="button" onClick={onSaveSnippet}>
            Save snippet…
          </button>
        )}
        <div className="overflow-menu-divider" />
        <button type="button" onClick={onClear}>
          Clear selection
        </button>
      </OverflowMenu>
    </div>
  );
}
