import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type AxisFixMode = 'auto' | 'unity' | 'none';

/** Unity / FBX often imports Z-up or flat on XZ — convert to Three.js Y-up. */
export function fixImportAxes(scene: THREE.Object3D, mode: AxisFixMode = 'auto'): string {
  scene.rotation.set(0, 0, 0);
  scene.position.set(0, 0, 0);
  scene.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);

  if (mode === 'none') return 'No axis change';

  if (mode === 'unity') {
    // Standard Unity → Three.js FBX fix
    scene.rotation.x = -Math.PI / 2;
    scene.updateMatrixWorld(true);
    return 'Unity fix: X −90°';
  }

  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  const { x, y, z } = size;
  const maxH = Math.max(x, y, z, 1e-6);

  // Lying flat on XZ plane (top-down view) — Y is thickness
  if (y < maxH * 0.45 && y < x && y < z) {
    scene.rotation.x = -Math.PI / 2;
    scene.updateMatrixWorld(true);
    return 'Auto: flat on floor → X −90°';
  }

  // Z-up (height along Z)
  if (z > y * 1.15 && z >= x * 0.85) {
    scene.rotation.x = -Math.PI / 2;
    scene.updateMatrixWorld(true);
    return 'Auto: Z-up → X −90°';
  }

  // X-up
  if (x > y * 1.15 && x >= z * 0.85) {
    scene.rotation.z = Math.PI / 2;
    scene.updateMatrixWorld(true);
    return 'Auto: X-up → Z +90°';
  }

  return 'Auto: axes look OK';
}

/** Scale and ground a character mesh. */
export function normalizeCharacter(scene: THREE.Object3D, targetHeight = 1.65) {
  scene.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) {
    scene.position.set(0, 0, 0);
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const scale = targetHeight / maxDim;
  scene.scale.multiplyScalar(scale);

  scene.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(scene);

  const center = box.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box.min.y;
}

export function frameCharacter(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.1);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.35;

  controls.target.set(center.x, center.y + size.y * 0.15, center.z);
  camera.position.set(center.x, center.y + size.y * 0.35, center.z + dist);
  camera.near = Math.max(0.01, dist / 100);
  camera.far = Math.max(100, dist * 20);
  camera.updateProjectionMatrix();
  controls.update();
}

export function fixFbxMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      if (!mat) return mat;

      if (mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial) {
        setTextureColorSpace(mat.map);
        setTextureColorSpace(mat.normalMap);
        setTextureColorSpace(mat.emissiveMap);
        setTextureColorSpace(mat.alphaMap);

        // Bump/normal without diffuse often looks like gray waves on skin
        if (!mat.map) {
          mat.bumpMap = null;
          mat.bumpScale = 0;
        }

        mat.side = THREE.DoubleSide;
        if (mat instanceof THREE.MeshPhongMaterial) {
          mat.specular.setHex(0x111111);
          mat.shininess = 12;
        }
        mat.needsUpdate = true;
        return mat;
      }

      if (mat instanceof THREE.MeshStandardMaterial) {
        setTextureColorSpace(mat.map);
        setTextureColorSpace(mat.normalMap);
        mat.metalness = Math.min(mat.metalness, 0.15);
        mat.roughness = Math.max(mat.roughness, 0.55);
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }

      return mat;
    });

    child.material = next.length === 1 ? next[0]! : next;
  });
}

function setTextureColorSpace(tex: THREE.Texture | null | undefined) {
  if (!tex) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

export function ensureVisibleMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;

      if ('map' in mat && mat.map instanceof THREE.Texture) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });
}

export function countMeshes(root: THREE.Object3D) {
  let meshes = 0;
  let skinned = 0;
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) skinned++;
    else if (o instanceof THREE.Mesh) meshes++;
  });
  return { meshes, skinned, total: meshes + skinned };
}

export async function validateFbxFile(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const text = new TextDecoder('ascii').decode(head);

  if (text.startsWith(';') || text.startsWith('FBX')) {
    return 'ASCII FBX is not supported. Re-export as Binary FBX from Unity.';
  }
  if (!text.startsWith('Kaydara FBX Binary')) {
    return 'File does not look like binary FBX.';
  }
  return null;
}
