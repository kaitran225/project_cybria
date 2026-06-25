import * as THREE from 'three';
import type { VisemeWeights } from './lipsync';
import {
  countMeshes,
  fixFbxMaterials,
  fixImportAxes,
  normalizeCharacter,
} from './model-utils';
import {
  auditTextures,
  createFbxLoader,
  prepareFbxLoadUrl,
  revokeTextureUrls,
  type FbxLoadOptions,
} from './fbx-loader';

const VISEME_KEYWORDS: Record<keyof VisemeWeights, string[]> = {
  aa: ['aa', 'a', 'mouth_a', 'mth_a', 'fcl_mth_a', 'jawopen', 'jaw_open', 'mouthopen'],
  ee: ['ee', 'e', 'mouth_e', 'mth_e', 'fcl_mth_e', 'smile'],
  ih: ['ih', 'i', 'mouth_i', 'mth_i', 'fcl_mth_i'],
  oh: ['oh', 'o', 'mouth_o', 'mth_o', 'fcl_mth_o'],
  ou: ['ou', 'u', 'mouth_u', 'mth_u', 'fcl_mth_u'],
};

export class FbxCharacter {
  private root: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private talkAction: THREE.AnimationAction | null = null;
  private talkClip: THREE.AnimationClip | null = null;
  private clips: THREE.AnimationClip[] = [];
  private morphMeshes: THREE.SkinnedMesh[] = [];
  private morphMap: Partial<Record<keyof VisemeWeights, number>> = {};
  private objectUrl: string | null = null;
  private textureUrls: Map<string, string> | null = null;
  private label = 'FBX model';
  private axisNote = '';
  private textureNote = '';

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

  get axisFixNote() {
    return this.axisNote;
  }

  get textureFixNote() {
    return this.textureNote;
  }

  async load(url: string, label?: string, options: FbxLoadOptions = {}): Promise<void> {
    this.dispose();
    if (label) this.label = label;

    const { loadUrl, textureBase, attachResourcePath } = prepareFbxLoadUrl(
      url,
      options.resourcePath,
    );

    const loader = createFbxLoader(textureBase, {
      textureUrls: options.textureUrls,
      attachResourcePath,
    });

    if (options.textureUrls) {
      this.textureUrls = options.textureUrls;
    }

    const fbx = await new Promise<THREE.Group>((resolve, reject) => {
      loader.load(loadUrl, resolve, undefined, reject);
    });

    fbx.traverse((obj) => {
      obj.frustumCulled = false;
      if (obj instanceof THREE.SkinnedMesh) {
        obj.skeleton?.update();
      }
      if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    fixFbxMaterials(fbx);
    this.axisNote = fixImportAxes(fbx, 'unity');
    normalizeCharacter(fbx);
    this.collectMorphTargets(fbx);

    const audit = auditTextures(fbx);
    if (audit.missingColorMap > 0) {
      this.textureNote =
        `${audit.withColorMap}/${audit.materials} materials have textures. ` +
        `Put .png/.jpg next to the .fbx or use "Load FBX folder".`;
    } else {
      this.textureNote = `Textures OK (${audit.withColorMap} materials)`;
    }

    this.root = fbx;
    this.parent.add(fbx);
    this.clips = fbx.animations ?? [];
    this.mixer = new THREE.AnimationMixer(fbx);

    if (this.clips.length > 0) {
      const idle = this.pickClip(['idle', 'wait', 'stand']) ?? this.clips[0];
      this.playClip(idle, true);
      this.idleAction = this.mixer.clipAction(idle);

      const talk = this.pickClip(['talk', 'speak', 'conversation']);
      if (talk) this.talkClip = talk;
    }
  }

  applyRotationDelta(rx = 0, ry = 0, rz = 0) {
    if (!this.root) return;
    this.root.rotation.x += rx;
    this.root.rotation.y += ry;
    this.root.rotation.z += rz;
    normalizeCharacter(this.root);
  }

  resetAxesUnity() {
    if (!this.root) return;
    this.axisNote = fixImportAxes(this.root, 'unity');
    normalizeCharacter(this.root);
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

  setTalking(speaking: boolean) {
    if (!this.mixer || !this.talkClip) return;

    if (speaking) {
      if (this.idleAction) this.idleAction.fadeOut(0.25);
      if (!this.talkAction) {
        this.talkAction = this.mixer.clipAction(this.talkClip);
        this.talkAction.setLoop(THREE.LoopRepeat, Infinity);
      }
      this.talkAction.reset().fadeIn(0.25).play();
    } else if (this.talkAction) {
      this.talkAction.fadeOut(0.25);
      this.talkAction = null;
      if (this.idleAction) this.idleAction.reset().fadeIn(0.25).play();
    }
  }

  update(delta: number, visemes: VisemeWeights) {
    if (!this.root) return;
    this.mixer?.update(delta);
    this.applyMorphVisemes(visemes);
  }

  trackObjectUrl(url: string) {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = url.startsWith('blob:') ? url : null;
  }

  dispose() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    revokeTextureUrls(this.textureUrls ?? undefined);
    this.textureUrls = null;

    this.mixer?.stopAllAction();
    this.mixer = null;
    this.idleAction = null;
    this.talkAction = null;
    this.talkClip = null;
    this.clips = [];
    this.morphMeshes = [];
    this.morphMap = {};

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

  private pickClip(keywords: string[]): THREE.AnimationClip | undefined {
    const lower = (s: string) => s.toLowerCase();
    for (const kw of keywords) {
      const hit = this.clips.find((c) => lower(c.name).includes(kw));
      if (hit) return hit;
    }
    return undefined;
  }

  private playClip(clip: THREE.AnimationClip, loop: boolean) {
    if (!this.mixer) return;
    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.play();
  }

  private collectMorphTargets(scene: THREE.Object3D) {
    this.morphMeshes = [];
    this.morphMap = {};

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;
      if (!obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
      this.morphMeshes.push(obj);

      for (const [name, index] of Object.entries(obj.morphTargetDictionary)) {
        const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        for (const [viseme, patterns] of Object.entries(VISEME_KEYWORDS)) {
          if (this.morphMap[viseme as keyof VisemeWeights] !== undefined) continue;
          if (patterns.some((p) => key.includes(p.replace(/[^a-z0-9_]/g, '')))) {
            this.morphMap[viseme as keyof VisemeWeights] = index;
          }
        }
      }
    });
  }

  private applyMorphVisemes(v: VisemeWeights) {
    if (this.morphMeshes.length === 0) return;

    for (const mesh of this.morphMeshes) {
      const influences = mesh.morphTargetInfluences;
      if (!influences) continue;

      for (const [viseme, index] of Object.entries(this.morphMap)) {
        if (index === undefined) continue;
        influences[index] = v[viseme as keyof VisemeWeights];
      }
    }
  }
}
