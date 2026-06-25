import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from '@pixiv/three-vrm-animation';
import type { VisemeWeights } from './lipsync';
import { countMeshes, ensureVisibleMaterials, normalizeCharacter } from './model-utils';

const POSE = {
  '0': {
    rotY: Math.PI,
    leftUpperArm: { x: Math.PI * 0.05, y: 0, z: Math.PI * 0.4 },
    rightUpperArm: { x: Math.PI * 0.05, y: 0, z: -Math.PI * 0.4 },
    leftLowerArm: { x: 0, y: -Math.PI * 0.1, z: 0 },
    rightLowerArm: { x: 0, y: Math.PI * 0.1, z: 0 },
  },
  '1': {
    rotY: 0,
    leftUpperArm: { x: Math.PI * 0.05, y: 0, z: -Math.PI * 0.4 },
    rightUpperArm: { x: Math.PI * 0.05, y: 0, z: Math.PI * 0.4 },
    leftLowerArm: { x: 0, y: -Math.PI * 0.1, z: 0 },
    rightLowerArm: { x: 0, y: Math.PI * 0.1, z: 0 },
  },
} as const;

export class VrmAvatar {
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private talkAction: THREE.AnimationAction | null = null;
  private talkClip: THREE.AnimationClip | null = null;
  private objectUrl: string | null = null;

  private blinkTimer = 0;
  private nextBlink = 2 + Math.random() * 4;
  private blinking = false;
  private blinkProgress = 0;

  constructor(private parent: THREE.Object3D) {}

  get loaded() {
    return this.vrm !== null;
  }

  get modelName() {
    const meta = this.vrm?.meta;
    if (!meta) return 'VRM model';
    if (meta.metaVersion === '1') return meta.name;
    return meta.title ?? 'VRM model';
  }

  get sceneRoot(): THREE.Object3D | null {
    return this.vrm?.scene ?? null;
  }

  get meshInfo() {
    return this.vrm ? countMeshes(this.vrm.scene) : null;
  }

  async load(url: string): Promise<void> {
    this.dispose();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await new Promise<THREE.Object3D & { userData: { vrm: VRM } }>(
      (resolve, reject) => {
        loader.load(
          url,
          (g) => resolve(g as unknown as THREE.Object3D & { userData: { vrm: VRM } }),
          undefined,
          reject,
        );
      },
    );

    const loaded = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(loaded.scene);
    VRMUtils.removeUnnecessaryJoints(loaded.scene);

    loaded.scene.traverse((obj) => {
      obj.frustumCulled = false;
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    ensureVisibleMaterials(loaded.scene);

    const version = loaded.meta?.metaVersion === '1' ? '1' : '0';
    loaded.scene.rotation.y = POSE[version].rotY;

    normalizeCharacter(loaded.scene);
    this.setIdlePose(loaded);

    this.vrm = loaded;
    this.parent.add(loaded.scene);
    this.mixer = new THREE.AnimationMixer(loaded.scene);
  }

  async loadIdleVrma(url: string) {
    if (!this.vrm || !this.mixer) return;
    const clip = await this.loadVrmaClip(url);
    if (this.idleAction) this.idleAction.stop();
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    this.idleAction = action;
  }

  async loadTalkVrma(url: string) {
    if (!this.vrm) return;
    this.talkClip = await this.loadVrmaClip(url);
  }

  setTalking(speaking: boolean) {
    if (!this.mixer || !this.talkClip) return;

    if (speaking) {
      if (this.idleAction) this.idleAction.fadeOut(0.25);
      if (!this.talkAction) {
        this.talkAction = this.mixer.clipAction(this.talkClip!);
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
    if (!this.vrm) return;

    this.mixer?.update(delta);
    this.vrm.update(delta);
    this.updateBlink(delta);
    this.applyVisemes(visemes);
    this.vrm.expressionManager?.update();
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
    this.talkAction = null;
    this.talkClip = null;

    if (this.vrm) {
      this.parent.remove(this.vrm.scene);
      this.vrm.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      this.vrm = null;
    }
  }

  private async loadVrmaClip(url: string): Promise<THREE.AnimationClip> {
    if (!this.vrm) throw new Error('No VRM loaded');

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    const gltf = await new Promise<{ userData: { vrmAnimations?: unknown[] } }>(
      (resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      },
    );

    const anims = gltf.userData.vrmAnimations;
    if (!anims?.length) throw new Error('No VRMA animation in file');
    return createVRMAnimationClip(anims[0] as never, this.vrm);
  }

  private setIdlePose(vrm: VRM) {
    const version = vrm.meta?.metaVersion === '1' ? '1' : '0';
    const cfg = POSE[version];
    const humanoid = vrm.humanoid;

    const lua = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rua = humanoid.getNormalizedBoneNode('rightUpperArm');
    const lla = humanoid.getNormalizedBoneNode('leftLowerArm');
    const rla = humanoid.getNormalizedBoneNode('rightLowerArm');

    if (lua) lua.rotation.set(cfg.leftUpperArm.x, cfg.leftUpperArm.y, cfg.leftUpperArm.z);
    if (rua) rua.rotation.set(cfg.rightUpperArm.x, cfg.rightUpperArm.y, cfg.rightUpperArm.z);
    if (lla) lla.rotation.set(cfg.leftLowerArm.x, cfg.leftLowerArm.y, cfg.leftLowerArm.z);
    if (rla) rla.rotation.set(cfg.rightLowerArm.x, cfg.rightLowerArm.y, cfg.rightLowerArm.z);
  }

  private updateBlink(delta: number) {
    const em = this.vrm?.expressionManager;
    if (!em) return;

    this.blinkTimer += delta;
    if (!this.blinking && this.blinkTimer >= this.nextBlink) {
      this.blinking = true;
      this.blinkProgress = 0;
    }

    if (!this.blinking) return;

    this.blinkProgress += delta * 8;
    let value: number;
    if (this.blinkProgress < 0.3) value = this.blinkProgress / 0.3;
    else value = 1 - (this.blinkProgress - 0.3) / 0.7;

    value = Math.max(0, value);
    this.setExpr('blink', value);
    this.setExpr('Blink', value);
    this.setExpr('eyeBlinkLeft', value);
    this.setExpr('eyeBlinkRight', value);

    if (this.blinkProgress >= 1) {
      this.blinking = false;
      this.blinkTimer = 0;
      this.nextBlink = 2 + Math.random() * 4;
      this.setExpr('blink', 0);
      this.setExpr('Blink', 0);
      this.setExpr('eyeBlinkLeft', 0);
      this.setExpr('eyeBlinkRight', 0);
    }
  }

  private applyVisemes(v: VisemeWeights) {
    this.setExpr('aa', v.aa);
    this.setExpr('ee', v.ee);
    this.setExpr('ih', v.ih);
    this.setExpr('oh', v.oh);
    this.setExpr('ou', v.ou);
    this.setExpr('a', v.aa);
    this.setExpr('i', v.ih);
    this.setExpr('u', v.ou);
    this.setExpr('e', v.ee);
    this.setExpr('o', v.oh);
    this.setExpr('jawOpen', v.aa * 0.7);
  }

  private setExpr(name: string, value: number) {
    try {
      this.vrm?.expressionManager?.setValue(name, value);
    } catch {
      // expression not on this model
    }
  }
}
