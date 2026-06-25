import type { VisemeWeights } from './lipsync';
import { normalizeCharacter } from './model-utils';
import type { FbxLoadOptions } from './fbx-loader';
import { FbxCharacter } from './fbx-character';
import { GltfCharacter } from './gltf-character';
import { VrmAvatar } from './vrm-avatar';

export type CharacterKind = 'none' | 'vrm' | 'fbx' | 'gltf';

export class CharacterHost {
  private vrm: VrmAvatar;
  private fbx: FbxCharacter;
  private gltf: GltfCharacter;
  private kind: CharacterKind = 'none';

  constructor(private parent: import('three').Object3D) {
    this.vrm = new VrmAvatar(this.parent);
    this.fbx = new FbxCharacter(this.parent);
    this.gltf = new GltfCharacter(this.parent);
  }

  get loaded() {
    return this.kind !== 'none';
  }

  get activeKind() {
    return this.kind;
  }

  get modelName() {
    switch (this.kind) {
      case 'vrm':
        return this.vrm.modelName;
      case 'fbx':
        return this.fbx.modelName;
      case 'gltf':
        return this.gltf.modelName;
      default:
        return '';
    }
  }

  get animationNames(): string[] {
    if (this.kind === 'fbx') return this.fbx.animationNames;
    if (this.kind === 'gltf') return this.gltf.animationNames;
    return [];
  }

  get meshInfo() {
    switch (this.kind) {
      case 'vrm':
        return this.vrm.meshInfo;
      case 'fbx':
        return this.fbx.meshInfo;
      case 'gltf':
        return this.gltf.meshInfo;
      default:
        return null;
    }
  }

  get sceneRoot(): import('three').Object3D | null {
    switch (this.kind) {
      case 'vrm':
        return this.vrm.sceneRoot;
      case 'fbx':
        return this.fbx.sceneRoot;
      case 'gltf':
        return this.gltf.sceneRoot;
      default:
        return null;
    }
  }

  reorient(rx = 0, ry = 0, rz = 0) {
    if (this.kind === 'fbx') {
      if (rx === 0 && ry === 0 && rz === 0) this.fbx.resetAxesUnity();
      else this.fbx.applyRotationDelta(rx, ry, rz);
    } else {
      const root = this.sceneRoot;
      if (!root) return;
      root.rotation.x += rx;
      root.rotation.y += ry;
      root.rotation.z += rz;
      normalizeCharacter(root);
    }
  }

  get axisFixNote(): string {
    if (this.kind === 'fbx') return this.fbx.axisFixNote;
    return '';
  }

  async loadVrm(url: string, label?: string) {
    this.clearAll();
    this.kind = 'vrm';
    this.vrm.trackObjectUrl(url);
    await this.vrm.load(url);
    void label;
  }

  get textureFixNote(): string {
    if (this.kind === 'fbx') return this.fbx.textureFixNote;
    return '';
  }

  async loadFbx(url: string, label?: string, options?: FbxLoadOptions) {
    this.clearAll();
    this.kind = 'fbx';
    this.fbx.trackObjectUrl(url);
    await this.fbx.load(url, label, options);
  }

  async loadGltf(url: string, label?: string) {
    this.clearAll();
    this.kind = 'gltf';
    this.gltf.trackObjectUrl(url);
    await this.gltf.load(url, label);
  }

  async loadIdleVrma(url: string) {
    if (this.kind !== 'vrm') throw new Error('VRMA only works with VRM models');
    await this.vrm.loadIdleVrma(url);
  }

  async loadTalkVrma(url: string) {
    if (this.kind !== 'vrm') throw new Error('VRMA only works with VRM models');
    await this.vrm.loadTalkVrma(url);
  }

  playAnimation(name: string) {
    if (this.kind === 'fbx') this.fbx.playClipByName(name);
    else if (this.kind === 'gltf') this.gltf.playClipByName(name);
  }

  setTalking(speaking: boolean) {
    if (this.kind === 'vrm') this.vrm.setTalking(speaking);
    else if (this.kind === 'fbx') this.fbx.setTalking(speaking);
    else if (this.kind === 'gltf') this.gltf.setTalking(speaking);
  }

  update(delta: number, visemes: VisemeWeights) {
    if (this.kind === 'vrm') this.vrm.update(delta, visemes);
    else if (this.kind === 'fbx') this.fbx.update(delta, visemes);
    else if (this.kind === 'gltf') this.gltf.update(delta, visemes);
  }

  trackObjectUrl(url: string) {
    if (this.kind === 'vrm') this.vrm.trackObjectUrl(url);
    else if (this.kind === 'fbx') this.fbx.trackObjectUrl(url);
    else if (this.kind === 'gltf') this.gltf.trackObjectUrl(url);
  }

  private clearAll() {
    this.vrm.dispose();
    this.fbx.dispose();
    this.gltf.dispose();
    this.kind = 'none';
  }
}
