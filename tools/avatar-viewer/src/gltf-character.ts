import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { VisemeWeights } from './lipsync';
import {
  countMeshes,
  ensureVisibleMaterials,
  normalizeCharacter,
} from './model-utils';

/** Standard glTF/GLB (e.g. converted from FBX via Blender). */
export class GltfCharacter {
  private root: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private clips: THREE.AnimationClip[] = [];
  private morphMeshes: THREE.Mesh[] = [];
  private objectUrl: string | null = null;
  private label = 'GLB model';

  constructor(private parent: THREE.Object3D) {}

  get loaded() {
    return this.root !== null;
  }

  get modelName() {
    return this.label;
  }

  get animationNames() {
    return this.clips.map((c) => c.name);
  }

  get meshInfo() {
    return this.root ? countMeshes(this.root) : null;
  }

  get sceneRoot() {
    return this.root;
  }

  async load(url: string, label?: string): Promise<void> {
    this.dispose();
    if (label) this.label = label;

    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
      (resolve, reject) => {
        loader.load(
          url,
          (g) => resolve({ scene: g.scene, animations: g.animations }),
          undefined,
          reject,
        );
      },
    );

    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.morphTargetDictionary) this.morphMeshes.push(obj);
      }
    });

    ensureVisibleMaterials(gltf.scene);
    normalizeCharacter(gltf.scene);
    this.root = gltf.scene;
    this.parent.add(gltf.scene);
    this.clips = gltf.animations;
    this.mixer = new THREE.AnimationMixer(gltf.scene);

    if (this.clips[0]) {
      const action = this.mixer.clipAction(this.clips[0]);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      this.idleAction = action;
    }
  }

  playClipByName(name: string) {
    const clip = this.clips.find((c) => c.name === name);
    if (!clip || !this.mixer) return;
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    this.idleAction = action;
  }

  setTalking(_speaking: boolean) {
    // GLB talk clip can be added later; lip-sync still works via morphs
  }

  update(delta: number, visemes: VisemeWeights) {
    if (!this.root) return;
    this.mixer?.update(delta);
    this.applyJawMorph(visemes.aa);
  }

  trackObjectUrl(url: string) {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = url.startsWith('blob:') ? url : null;
  }

  dispose() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.idleAction = null;
    this.clips = [];
    this.morphMeshes = [];

    if (this.root) {
      this.parent.remove(this.root);
      this.root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      this.root = null;
    }
  }

  private applyJawMorph(jaw: number) {
    for (const mesh of this.morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      if (!dict || !inf) continue;
      for (const [name, idx] of Object.entries(dict)) {
        const n = name.toLowerCase();
        if (n.includes('jaw') || n.includes('mouth') || n === 'aa' || n.includes('mth_a')) {
          inf[idx] = jaw;
        }
      }
    }
  }
}
