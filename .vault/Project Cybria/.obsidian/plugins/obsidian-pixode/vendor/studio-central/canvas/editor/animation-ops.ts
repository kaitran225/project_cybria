import type { Animation, AnimationGraph, Layer, PixelAssetDocument } from "@pixode/asset-core";
import { cloneLayer, updateLayerPixels } from "./layer-ops.js";

function defaultAnimations(doc: PixelAssetDocument): AnimationGraph {
  const layerIds = doc.layers.map((l) => l.id);
  return {
    states: [
      {
        id: "idle",
        name: "Idle",
        loop: true,
        frames: [{ layerIds, duration: 200 }],
      },
    ],
    transitions: [],
  };
}

function findAnimation(
  doc: PixelAssetDocument,
  animId: string
): { animations: AnimationGraph; animIdx: number; anim: Animation } | null {
  const animations = doc.animations ?? defaultAnimations(doc);
  const animIdx = animations.states.findIndex((s) => s.id === animId);
  if (animIdx === -1) return null;
  return { animations, animIdx, anim: animations.states[animIdx] };
}

function nextLayerId(doc: PixelAssetDocument, base = "layer"): string {
  let n = doc.layers.length + 1;
  let id = `${base}_${n}`;
  while (doc.layers.some((l) => l.id === id)) {
    n += 1;
    id = `${base}_${n}`;
  }
  return id;
}

function cloneIdForFrame(doc: PixelAssetDocument, sourceId: string): string {
  let n = doc.layers.length + 1;
  let id = `${sourceId}_f${n}`;
  while (doc.layers.some((l) => l.id === id)) {
    n += 1;
    id = `${sourceId}_f${n}`;
  }
  return id;
}

function referencedLayerIds(doc: PixelAssetDocument): Set<string> {
  const ids = new Set<string>();
  const states = doc.animations?.states ?? defaultAnimations(doc).states;
  for (const state of states) {
    for (const frame of state.frames) {
      for (const id of frame.layerIds) ids.add(id);
    }
  }
  return ids;
}

function pruneUnreferencedLayers(doc: PixelAssetDocument): PixelAssetDocument {
  const refs = referencedLayerIds(doc);
  const layers = doc.layers.filter((l) => refs.has(l.id));
  if (layers.length === doc.layers.length) return doc;
  return { ...doc, layers: layers.length > 0 ? layers : doc.layers };
}

export function getActiveFrameLayerIds(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number
): string[] {
  const states = doc.animations?.states ?? defaultAnimations(doc).states;
  const anim = states.find((s) => s.id === animId) ?? states[0];
  if (!anim) return doc.layers.map((l) => l.id);
  const frame = anim.frames[frameIndex] ?? anim.frames[0];
  return frame?.layerIds ?? doc.layers.map((l) => l.id);
}

export function getFrameLayers(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number
): Layer[] {
  return getActiveFrameLayerIds(doc, animId, frameIndex)
    .map((id) => doc.layers.find((l) => l.id === id))
    .filter((l): l is Layer => l != null);
}

/** Top (active) layer id for a frame, or undefined when the frame has no layers. */
export function resolveActiveLayerForFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number
): string | undefined {
  const ids = getActiveFrameLayerIds(doc, animId, frameIndex);
  return ids.length > 0 ? ids[ids.length - 1] : undefined;
}

/** Guarantee at least one animation state with one frame referencing existing layers. */
export function ensureDocumentAnimations(
  doc: PixelAssetDocument
): PixelAssetDocument {
  const layerIds = doc.layers.map((l) => l.id);
  if (layerIds.length === 0) return doc;

  const transitions = doc.animations?.transitions ?? [];
  let states = doc.animations?.states ? [...doc.animations.states] : [];
  let changed = false;

  if (states.length === 0) {
    states = [
      {
        id: "idle",
        name: "Idle",
        loop: true,
        frames: [{ layerIds: [...layerIds], duration: 200 }],
      },
    ];
    changed = true;
  } else {
    states = states.map((state) => {
      const frames =
        state.frames.length > 0
          ? state.frames.map((frame) => {
              const ids = frame.layerIds.filter((id) => layerIds.includes(id));
              if (ids.length > 0) {
                if (ids.length !== frame.layerIds.length) changed = true;
                return { ...frame, layerIds: ids };
              }
              changed = true;
              return { ...frame, layerIds: [...layerIds] };
            })
          : ((changed = true),
            [{ layerIds: [...layerIds], duration: 200 }]);
      return { ...state, frames };
    });
  }

  if (!changed) return doc;
  return {
    ...doc,
    animations: { states, transitions },
  };
}

export function prepareDocumentForStudio(
  doc: PixelAssetDocument
): PixelAssetDocument {
  return ensurePerFrameLayerIsolation(ensureDocumentAnimations(doc));
}

export function ensurePerFrameLayerIsolation(
  doc: PixelAssetDocument
): PixelAssetDocument {
  const animations = doc.animations;
  if (!animations?.states.length) return doc;

  const usage = new Map<
    string,
    Array<{ stateIdx: number; frameIdx: number; layerIdx: number }>
  >();

  animations.states.forEach((state, stateIdx) => {
    state.frames.forEach((frame, frameIdx) => {
      frame.layerIds.forEach((layerId, layerIdx) => {
        const list = usage.get(layerId) ?? [];
        list.push({ stateIdx, frameIdx, layerIdx });
        usage.set(layerId, list);
      });
    });
  });

  let layers = [...doc.layers];
  const states = animations.states.map((state) => ({
    ...state,
    frames: state.frames.map((frame) => ({
      ...frame,
      layerIds: [...frame.layerIds],
    })),
  }));

  let changed = false;
  for (const [layerId, refs] of usage) {
    if (refs.length <= 1) continue;
    const source = layers.find((l) => l.id === layerId);
    if (!source) continue;

    for (let i = 1; i < refs.length; i++) {
      const ref = refs[i];
      const newId = cloneIdForFrame({ ...doc, layers }, layerId);
      layers.push(cloneLayer(source, newId, source.name));
      states[ref.stateIdx].frames[ref.frameIdx].layerIds[ref.layerIdx] = newId;
      changed = true;
    }
  }

  if (!changed) return doc;
  return {
    ...doc,
    layers,
    animations: { ...animations, states },
  };
}

export function createLayerForFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number,
  name?: string
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  if (!anim.frames[frameIndex]) return doc;

  const id = nextLayerId(doc);
  const layerName = name ?? `Layer ${anim.frames[frameIndex].layerIds.length + 1}`;
  const newLayer: Layer = { id, name: layerName, visible: true, pixels: [] };
  const frames = anim.frames.map((frame, i) =>
    i === frameIndex ? { ...frame, layerIds: [...frame.layerIds, id] } : frame
  );
  const states = [...animations.states];
  states[animIdx] = { ...anim, frames };

  return {
    ...doc,
    layers: [...doc.layers, newLayer],
    animations: { ...animations, states },
  };
}

export function deleteLayerForFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number,
  layerId: string
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  const frame = anim.frames[frameIndex];
  if (!frame || frame.layerIds.length <= 1) return doc;
  if (!frame.layerIds.includes(layerId)) return doc;

  const frames = anim.frames.map((f, i) =>
    i === frameIndex
      ? { ...f, layerIds: f.layerIds.filter((id) => id !== layerId) }
      : f
  );
  const states = [...animations.states];
  states[animIdx] = { ...anim, frames };

  return pruneUnreferencedLayers({
    ...doc,
    animations: { ...animations, states },
  });
}

/** Visual list is reversed: index 0 = front (top of stack). */
export function visualToStorageIndex(
  visualIndex: number,
  layerCount: number
): number {
  return layerCount - 1 - visualIndex;
}

export function storageToVisualIndex(
  storageIndex: number,
  layerCount: number
): number {
  return layerCount - 1 - storageIndex;
}

export function duplicateLayerForFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number,
  layerId: string
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  const frame = anim.frames[frameIndex];
  if (!frame) return doc;

  const sourceIdx = frame.layerIds.indexOf(layerId);
  if (sourceIdx === -1) return doc;

  const source = doc.layers.find((l) => l.id === layerId);
  if (!source) return doc;

  const newId = nextLayerId(doc);
  const newLayer = cloneLayer(source, newId, `${source.name} copy`);
  const layerIds = [...frame.layerIds];
  layerIds.splice(sourceIdx + 1, 0, newId);

  const frames = anim.frames.map((f, i) =>
    i === frameIndex ? { ...f, layerIds } : f
  );
  const states = [...animations.states];
  states[animIdx] = { ...anim, frames };

  return {
    ...doc,
    layers: [...doc.layers, newLayer],
    animations: { ...animations, states },
  };
}

export function clearLayerForFrame(
  doc: PixelAssetDocument,
  layerId: string
): PixelAssetDocument {
  return updateLayerPixels(doc, layerId, []);
}

export function reorderLayersForFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number,
  fromIndex: number,
  toIndex: number
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  const frame = anim.frames[frameIndex];
  if (!frame) return doc;

  const layerIds = [...frame.layerIds];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= layerIds.length ||
    toIndex >= layerIds.length
  ) {
    return doc;
  }
  const [item] = layerIds.splice(fromIndex, 1);
  layerIds.splice(toIndex, 0, item);

  const frames = anim.frames.map((f, i) =>
    i === frameIndex ? { ...f, layerIds } : f
  );
  const states = [...animations.states];
  states[animIdx] = { ...anim, frames };

  return { ...doc, animations: { ...animations, states } };
}

export function renameLayerForFrame(
  doc: PixelAssetDocument,
  layerId: string,
  name: string
): PixelAssetDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) => (l.id === layerId ? { ...l, name } : l)),
  };
}

export function toggleLayerVisibilityForFrame(
  doc: PixelAssetDocument,
  layerId: string
): PixelAssetDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ),
  };
}

function cloneFrameLayers(
  doc: PixelAssetDocument,
  sourceLayerIds: string[]
): { doc: PixelAssetDocument; layerIds: string[] } {
  let layers = [...doc.layers];
  const newLayerIds: string[] = [];

  for (const layerId of sourceLayerIds) {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) continue;
    const newId = cloneIdForFrame({ ...doc, layers }, layerId);
    layers.push(cloneLayer(layer, newId, layer.name));
    newLayerIds.push(newId);
  }

  return { doc: { ...doc, layers }, layerIds: newLayerIds };
}

export function addAnimationState(
  doc: PixelAssetDocument,
  animId: string,
  name?: string
): PixelAssetDocument {
  const animations = doc.animations ?? defaultAnimations(doc);
  if (animations.states.some((s) => s.id === animId)) return doc;

  const sourceState = animations.states[0];
  const sourceFrame = sourceState?.frames[sourceState.frames.length - 1];
  const sourceLayerIds =
    sourceFrame?.layerIds.length
      ? sourceFrame.layerIds
      : doc.layers.map((l) => l.id);

  const { doc: withLayers, layerIds } = cloneFrameLayers(doc, sourceLayerIds);
  const newState: Animation = {
    id: animId,
    name: name ?? animId,
    loop: true,
    frames: [{ layerIds, duration: 200 }],
  };

  return {
    ...withLayers,
    animations: {
      ...animations,
      states: [...animations.states, newState],
    },
  };
}

export function duplicateAnimationFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  const frame = anim.frames[frameIndex];
  if (!frame) return doc;

  const { doc: withLayers, layerIds } = cloneFrameLayers(doc, frame.layerIds);
  const newFrames = [...anim.frames];
  newFrames.splice(frameIndex + 1, 0, {
    layerIds,
    duration: frame.duration,
  });

  const states = [...animations.states];
  states[animIdx] = { ...anim, frames: newFrames };

  return {
    ...withLayers,
    animations: { ...animations, states },
  };
}

export function addAnimationFrameFromLast(
  doc: PixelAssetDocument,
  animId: string
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const lastIndex = found.anim.frames.length - 1;
  return duplicateAnimationFrame(doc, animId, lastIndex);
}

export function deleteAnimationFrame(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  if (anim.frames.length <= 1) return doc;

  const frames = anim.frames.filter((_, i) => i !== frameIndex);
  const states = [...animations.states];
  states[animIdx] = { ...anim, frames };

  return pruneUnreferencedLayers({
    ...doc,
    animations: { ...animations, states },
  });
}

export function reorderAnimationFrame(
  doc: PixelAssetDocument,
  animId: string,
  fromIndex: number,
  toIndex: number
): PixelAssetDocument {
  const found = findAnimation(doc, animId);
  if (!found) return doc;
  const { animations, animIdx, anim } = found;
  const frames = [...anim.frames];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= frames.length ||
    toIndex >= frames.length
  ) {
    return doc;
  }
  const [item] = frames.splice(fromIndex, 1);
  frames.splice(toIndex, 0, item);

  const states = [...animations.states];
  states[animIdx] = { ...anim, frames };

  return { ...doc, animations: { ...animations, states } };
}
