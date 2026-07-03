import { useCallback, useEffect } from "react";
import type { PixelAssetDocument } from "@pixode/asset-core";
import {
  clearLayerForFrame,
  createLayerForFrame,
  deleteLayerForFrame,
  duplicateLayerForFrame,
  getFrameLayers,
  renameLayerForFrame,
  reorderLayersForFrame,
  storageToVisualIndex,
  toggleLayerVisibilityForFrame,
} from "../editor/animation-ops.js";
import { LayerThumbnail } from "./LayerThumbnail.js";
import { OverflowMenu } from "./OverflowMenu.js";
import { useLayerDragReorder } from "./use-layer-drag-reorder.js";

function LayerEyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path
          fill="currentColor"
          d="M8 3.5C4.8 3.5 2.2 5.8 1.5 8c.7 2.2 3.3 4.5 6.5 4.5s5.8-2.3 6.5-4.5c-.7-2.2-3.3-4.5-6.5-4.5zm0 7.5a3 3 0 100-6 3 3 0 000 6z"
        />
        <circle fill="currentColor" cx="8" cy="8" r="1.25" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M2.3 2.3 13.7 13.7M6.2 6.7A2.2 2.2 0 008 10.2a2.2 2.2 0 001.8-.9M4.4 4.6C3.3 5.4 2.4 6.6 1.9 8c.7 2.2 3.3 4.5 6.5 4.5.9 0 1.7-.2 2.5-.5M11.1 11.1c1-.6 1.8-1.4 2.4-2.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function LayerGripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden>
      <circle fill="currentColor" cx="2.5" cy="2.5" r="1.1" />
      <circle fill="currentColor" cx="7.5" cy="2.5" r="1.1" />
      <circle fill="currentColor" cx="2.5" cy="7" r="1.1" />
      <circle fill="currentColor" cx="7.5" cy="7" r="1.1" />
      <circle fill="currentColor" cx="2.5" cy="11.5" r="1.1" />
      <circle fill="currentColor" cx="7.5" cy="11.5" r="1.1" />
    </svg>
  );
}

export function LayerPanel({
  document,
  activeLayerId,
  onChange,
  onSelectLayer,
  activeAnimationId,
  activeFrameIndex = 0,
  onRegisterAdd,
}: {
  document: PixelAssetDocument;
  activeLayerId: string;
  onChange: (doc: PixelAssetDocument) => void;
  onSelectLayer: (layerId: string) => void;
  activeAnimationId: string;
  activeFrameIndex?: number;
  onRegisterAdd?: (add: () => void) => void;
}) {
  const animId =
    activeAnimationId ||
    document.animations?.states[0]?.id ||
    "idle";
  const frameLayers = getFrameLayers(document, animId, activeFrameIndex);
  const layerIds =
    document.animations?.states
      .find((s) => s.id === animId)
      ?.frames[activeFrameIndex]?.layerIds ?? frameLayers.map((l) => l.id);

  const handleAdd = useCallback(() => {
    const next = createLayerForFrame(
      document,
      animId,
      activeFrameIndex,
      `Layer ${frameLayers.length + 1}`
    );
    const ids = next.animations?.states
      .find((s) => s.id === animId)
      ?.frames[activeFrameIndex]?.layerIds;
    const newId = ids?.[ids.length - 1];
    onChange(next);
    if (newId) onSelectLayer(newId);
  }, [
    document,
    animId,
    activeFrameIndex,
    frameLayers.length,
    onChange,
    onSelectLayer,
  ]);

  useEffect(() => {
    onRegisterAdd?.(handleAdd);
  }, [onRegisterAdd, handleAdd]);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      onChange(
        reorderLayersForFrame(
          document,
          animId,
          activeFrameIndex,
          fromIndex,
          toIndex
        )
      );
    },
    [document, animId, activeFrameIndex, onChange]
  );

  const {
    listRef,
    dragState,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
  } = useLayerDragReorder({ layerIds, onReorder: handleReorder });

  const visualLayers = [...frameLayers].reverse();

  return (
    <div className="canvas-layer-panel">
      <ul className="canvas-layer-list" ref={listRef}>
        {visualLayers.map((layer) => {
          const storageIdx = layerIds.indexOf(layer.id);
          const isActive = layer.id === activeLayerId;
          const isDragging = dragState.draggingId === layer.id;
          const isDropBefore =
            dragState.dropTargetId === layer.id &&
            dragState.dropPosition === "before";
          const isDropAfter =
            dragState.dropTargetId === layer.id &&
            dragState.dropPosition === "after";
          const hasPixels = layer.pixels.length > 0;

          return (
            <li
              key={layer.id}
              data-layer-id={layer.id}
              className={`canvas-layer-item${isActive ? " active" : ""}${
                isDragging ? " canvas-layer-item--dragging" : ""
              }${isDropBefore ? " canvas-layer-item--drop-before" : ""}${
                isDropAfter ? " canvas-layer-item--drop-after" : ""
              }`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <button
                type="button"
                className="canvas-layer-drag-handle"
                aria-label="Drag to reorder layer"
                onPointerDown={(e) =>
                  onHandlePointerDown(e, layer.id, storageIdx)
                }
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onClick={(e) => e.stopPropagation()}
              >
                <LayerGripIcon />
              </button>
              <div className="canvas-layer-item__preview">
                <LayerThumbnail
                  document={document}
                  layerId={layer.id}
                  animId={animId}
                  frameIndex={activeFrameIndex}
                  size={32}
                />
              </div>
              <div className="canvas-layer-item__body">
                <div className="canvas-layer-item__top">
                  <button
                    type="button"
                    className={`canvas-layer-visibility${
                      layer.visible ? " is-visible" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(toggleLayerVisibilityForFrame(document, layer.id));
                    }}
                    title={layer.visible ? "Hide layer" : "Show layer"}
                    aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  >
                    <LayerEyeIcon visible={layer.visible} />
                  </button>
                  <input
                    className="canvas-layer-name"
                    value={layer.name}
                    onChange={(e) =>
                      onChange(
                        renameLayerForFrame(document, layer.id, e.target.value)
                      )
                    }
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => onSelectLayer(layer.id)}
                  />
                  <OverflowMenu
                    ariaLabel={`Layer actions: ${layer.name}`}
                    className="canvas-layer-overflow"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = duplicateLayerForFrame(
                          document,
                          animId,
                          activeFrameIndex,
                          layer.id
                        );
                        onChange(next);
                        const frame = next.animations?.states
                          .find((s) => s.id === animId)
                          ?.frames[activeFrameIndex];
                        const dupIdx = frame?.layerIds.indexOf(layer.id) ?? -1;
                        const newId =
                          dupIdx >= 0
                            ? frame?.layerIds[dupIdx + 1]
                            : undefined;
                        if (newId) onSelectLayer(newId);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={!hasPixels}
                      onClick={() =>
                        onChange(clearLayerForFrame(document, layer.id))
                      }
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="overflow-menu-danger"
                      disabled={frameLayers.length <= 1}
                      onClick={() => {
                        const next = deleteLayerForFrame(
                          document,
                          animId,
                          activeFrameIndex,
                          layer.id
                        );
                        onChange(next);
                        if (layer.id === activeLayerId) {
                          const remaining = getFrameLayers(
                            next,
                            animId,
                            activeFrameIndex
                          );
                          const visualIdx = storageToVisualIndex(
                            storageIdx,
                            frameLayers.length
                          );
                          const fallback =
                            remaining[
                              Math.min(
                                visualIdx,
                                Math.max(0, remaining.length - 1)
                              )
                            ];
                          if (fallback) onSelectLayer(fallback.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </OverflowMenu>
                </div>
              </div>
            </li>
          );
        })}
        <li className="canvas-layer-list__add">
          <button
            type="button"
            className="canvas-layer-item canvas-layer-item--add"
            onClick={handleAdd}
            title="Add layer"
            aria-label="Add layer"
          >
            <span className="canvas-layer-item__preview canvas-layer-item__preview--add" aria-hidden>
              +
            </span>
            <span className="canvas-layer-item__add-label">New layer</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
