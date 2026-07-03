import { useCallback, useEffect, useRef, useState } from "react";

export type LayerDropPosition = "before" | "after";

export interface LayerDragState {
  draggingId: string | null;
  dropTargetId: string | null;
  dropPosition: LayerDropPosition | null;
}

export function resolveDropStorageIndex(
  layerIds: string[],
  fromStorageIndex: number,
  targetStorageIndex: number,
  position: LayerDropPosition
): number {
  let toIndex = position === "before" ? targetStorageIndex : targetStorageIndex + 1;
  if (fromStorageIndex < toIndex) toIndex -= 1;
  return Math.max(0, Math.min(layerIds.length - 1, toIndex));
}

export function useLayerDragReorder({
  layerIds,
  onReorder,
}: {
  layerIds: string[];
  onReorder: (fromStorageIndex: number, toStorageIndex: number) => void;
}) {
  const [dragState, setDragState] = useState<LayerDragState>({
    draggingId: null,
    dropTargetId: null,
    dropPosition: null,
  });
  const dragRef = useRef<{
    layerId: string;
    storageIndex: number;
    pointerId: number;
  } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setDragState({
      draggingId: null,
      dropTargetId: null,
      dropPosition: null,
    });
  }, []);

  const findDropTarget = useCallback(
    (clientY: number): { id: string; position: LayerDropPosition } | null => {
      const list = listRef.current;
      if (!list) return null;

      const items = list.querySelectorAll<HTMLElement>("[data-layer-id]");
      for (const item of items) {
        const id = item.dataset.layerId;
        if (!id || id === dragRef.current?.layerId) continue;
        const rect = item.getBoundingClientRect();
        if (clientY < rect.top || clientY > rect.bottom) continue;
        const mid = rect.top + rect.height / 2;
        return { id, position: clientY < mid ? "before" : "after" };
      }
      return null;
    },
    []
  );

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, layerId: string, storageIndex: number) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        layerId,
        storageIndex,
        pointerId: e.pointerId,
      };
      setDragState({
        draggingId: layerId,
        dropTargetId: null,
        dropPosition: null,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      const target = findDropTarget(e.clientY);
      if (!target) {
        setDragState((s) => ({
          ...s,
          dropTargetId: null,
          dropPosition: null,
        }));
        return;
      }
      setDragState({
        draggingId: dragRef.current.layerId,
        dropTargetId: target.id,
        dropPosition: target.position,
      });
    },
    [findDropTarget]
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      const { layerId, storageIndex: fromIndex } = dragRef.current;
      const target = findDropTarget(e.clientY);

      if (target && target.id !== layerId) {
        const targetStorageIndex = layerIds.indexOf(target.id);
        if (targetStorageIndex !== -1) {
          const toIndex = resolveDropStorageIndex(
            layerIds,
            fromIndex,
            targetStorageIndex,
            target.position
          );
          if (toIndex !== fromIndex) {
            onReorder(fromIndex, toIndex);
          }
        }
      }

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      clearDrag();
    },
    [layerIds, onReorder, findDropTarget, clearDrag]
  );

  useEffect(() => {
    if (!dragState.draggingId) return;
    const onCancel = () => clearDrag();
    window.addEventListener("pointercancel", onCancel);
    return () => window.removeEventListener("pointercancel", onCancel);
  }, [dragState.draggingId, clearDrag]);

  return {
    listRef,
    dragState,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    clearDrag,
  };
}
