import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { frameCharacter as frameObject } from './model-utils';

export class Viewport {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly clock = new THREE.Clock();

  private raf = 0;
  private onFrame: ((delta: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 1.35, 2.8);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.1, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 6;
    this.controls.update();

    this.setupLights();
    this.setupFloor();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setFrameCallback(cb: (delta: number) => void) {
    this.onFrame = cb;
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      this.controls.update();
      this.onFrame?.(delta);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  frameCharacter(object: THREE.Object3D) {
    frameObject(object, this.camera, this.controls);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.renderer.dispose();
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x443322, 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(2, 4, 3);
    key.castShadow = true;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xfff5ee, 0.55);
    fill.position.set(-2, 2, -1);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xc8d8ff, 0.25);
    rim.position.set(0, 2, -3);
    this.scene.add(rim);
  }

  private setupFloor() {
    const grid = new THREE.GridHelper(6, 24, 0x555566, 0x33333f);
    grid.position.y = 0;
    this.scene.add(grid);
  }

  private resize() {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
