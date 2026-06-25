import * as THREE from 'three';
import { Viewport } from './viewport';
import { CharacterHost } from './character-host';
import { VoiceController } from './voice';
import { validateFbxFile } from './model-utils';
import { buildTextureUrlMap, dirnameUrl } from './fbx-loader';

/** Bundled fallback — always works offline */
const DEMO_GLB = '/demo/RobotExpressive.glb';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  const canvas = $('viewport') as HTMLCanvasElement;
  const modelStatus = $('model-status');
  const animStatus = $('anim-status');
  const voiceStatus = $('voice-status');
  const speechText = $('speech-text') as HTMLTextAreaElement;
  const voiceRate = $('voice-rate') as HTMLInputElement;
  const animSelect = $('anim-select') as HTMLSelectElement;
  const vrmaSection = $('vrma-section');
  const localAssets = $('local-assets');

  const axisSection = $('axis-section');
  const axisStatus = $('axis-status');

  const viewport = new Viewport(canvas);
  const avatarRoot = new THREE.Group();
  viewport.scene.add(avatarRoot);

  const character = new CharacterHost(avatarRoot);
  const voice = new VoiceController();

  function reframe() {
    const root = character.sceneRoot;
    if (root) viewport.frameCharacter(root);
  }

  function nudgeAxis(rx = 0, ry = 0, rz = 0) {
    if (!character.loaded) return;
    character.reorient(rx, ry, rz);
    axisStatus.textContent = character.axisFixNote || `Rotation adjusted`;
    reframe();
  }

  $('axis-unity').addEventListener('click', () => {
    if (!character.loaded) return;
    character.reorient();
    axisStatus.textContent = character.axisFixNote || 'Unity axes applied';
    reframe();
  });
  $('axis-x-minus').addEventListener('click', () => nudgeAxis(-Math.PI / 2, 0, 0));
  $('axis-x-plus').addEventListener('click', () => nudgeAxis(Math.PI / 2, 0, 0));
  $('axis-y-180').addEventListener('click', () => nudgeAxis(0, Math.PI, 0));

  voice.setListener(({ speaking, message }) => {
    voiceStatus.textContent = message;
    character.setTalking(speaking);
  });

  viewport.setFrameCallback((delta) => {
    const visemes = voice.update(delta);
    character.update(delta, visemes);
  });
  viewport.start();

  window.speechSynthesis?.getVoices();

  await refreshLocalAssets(localAssets, (url, kind, name) => loadFromUrl(kind, url, name));

  $('vrm-input').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await loadModel('vrm', file);
    (e.target as HTMLInputElement).value = '';
  });

  $('fbx-input').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    modelStatus.textContent =
      'Loading FBX… For textures, use "Load FBX folder" or place files under asset/.';
    await loadModel('fbx', file);
    (e.target as HTMLInputElement).value = '';
  });

  $('fbx-folder-input').addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files?.length) return;

    const fbxFile = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.fbx'));
    if (!fbxFile) {
      modelStatus.textContent = 'No .fbx file in selected folder';
      return;
    }

    const err = await validateFbxFile(fbxFile);
    if (err) {
      modelStatus.textContent = err;
      return;
    }

    const textureUrls = buildTextureUrlMap(files);
    const url = URL.createObjectURL(fbxFile);
    await loadFromUrl('fbx', url, fbxFile.name, true, { textureUrls });
    (e.target as HTMLInputElement).value = '';
  });

  $('glb-input').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await loadModel('gltf', file);
    (e.target as HTMLInputElement).value = '';
  });

  $('demo-glb').addEventListener('click', () => loadFromUrl('gltf', DEMO_GLB, 'Demo robot'));

  animSelect.addEventListener('change', () => {
    const name = animSelect.value;
    if (name) character.playAnimation(name);
  });

  $('idle-vrma-input').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !character.loaded) return;
    const url = URL.createObjectURL(file);
    try {
      await character.loadIdleVrma(url);
      animStatus.textContent = `Idle VRMA: ${file.name}`;
    } catch (err) {
      animStatus.textContent = `Idle VRMA error: ${err}`;
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  $('talk-vrma-input').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !character.loaded) return;
    const url = URL.createObjectURL(file);
    try {
      await character.loadTalkVrma(url);
      animStatus.textContent = `Talk VRMA: ${file.name}`;
    } catch (err) {
      animStatus.textContent = `Talk VRMA error: ${err}`;
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  $('speak-btn').addEventListener('click', () => {
    if (!character.loaded) {
      voiceStatus.textContent = 'Load a model first';
      return;
    }
    voice.speak(speechText.value, parseFloat(voiceRate.value));
  });

  $('stop-btn').addEventListener('click', () => voice.stop());

  async function loadModel(kind: 'vrm' | 'fbx' | 'gltf', file: File) {
    if (kind === 'fbx') {
      const err = await validateFbxFile(file);
      if (err) {
        modelStatus.textContent = err;
        return;
      }
    }

    const url = URL.createObjectURL(file);
    await loadFromUrl(kind, url, file.name, true);
  }

  async function loadFromUrl(
    kind: 'vrm' | 'fbx' | 'gltf',
    url: string,
    label: string,
    isBlob = false,
    fbxOptions?: { textureUrls?: Map<string, string> },
  ) {
    modelStatus.textContent = `Loading ${label}…`;
    try {
      if (kind === 'vrm') await character.loadVrm(url, label);
      else if (kind === 'fbx') {
        const resourcePath = isBlob ? undefined : dirnameUrl(url);
        await character.loadFbx(url, label, {
          resourcePath: resourcePath || undefined,
          textureUrls: fbxOptions?.textureUrls,
        });
      } else await character.loadGltf(url, label);

      const root = character.sceneRoot;
      if (root) viewport.frameCharacter(root);

      axisSection.hidden = false;
      axisStatus.textContent = character.axisFixNote || 'Adjust orientation below if needed';

      const info = character.meshInfo;
      if (!info || info.total === 0) {
        modelStatus.textContent = `Loaded but 0 meshes — file may be empty or unsupported`;
        return;
      }

      onModelLoaded(label, kind, info);
    } catch (err) {
      modelStatus.textContent = `Load failed: ${err}`;
      console.error(err);
      if (isBlob) URL.revokeObjectURL(url);
    }
  }

  function onModelLoaded(
    label: string,
    kind: 'vrm' | 'fbx' | 'gltf',
    info: { meshes: number; skinned: number; total: number },
  ) {
    modelStatus.textContent =
      `Loaded [${kind.toUpperCase()}]: ${character.modelName || label} — ${info.total} mesh(es)`;

    if (character.textureFixNote) {
      modelStatus.textContent += ` · ${character.textureFixNote}`;
    }

    vrmaSection.hidden = kind !== 'vrm';

    const names = character.animationNames;
    animSelect.innerHTML = '';
    if (names.length > 0) {
      for (const name of names) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        animSelect.appendChild(opt);
      }
      animStatus.textContent = `${names.length} animation clip(s)`;
    } else if (kind === 'vrm') {
      animStatus.textContent = 'Procedural blink — optional VRMA clips';
    } else {
      animStatus.textContent = 'No animations — lip-sync uses morph targets if present';
    }
  }
}

type LocalModel = { name: string; url: string; kind: string };

async function refreshLocalAssets(
  container: HTMLElement,
  onPick: (url: string, kind: 'vrm' | 'fbx' | 'gltf', name: string) => void,
) {
  container.innerHTML = '';

  try {
    const res = await fetch('/api/local-models');
    const data = (await res.json()) as { models: LocalModel[] };

    if (data.models.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint warn';
      p.textContent =
        'No models under asset/. Export Milltina FBX + textures into asset/Milltina_ver1.01.1/ (same folder), then refresh.';
      container.appendChild(p);
      return;
    }

    const title = document.createElement('p');
    title.className = 'hint';
    title.textContent = 'Files found in asset/ (click to load):';
    container.appendChild(title);

    const row = document.createElement('div');
    row.className = 'row';
    for (const m of data.models) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn secondary';
      btn.textContent = m.name;
      btn.title = m.url;
      btn.addEventListener('click', () => {
        const kind = m.kind === 'glb' || m.kind === 'gltf' ? 'gltf' : (m.kind as 'fbx' | 'vrm');
        onPick(m.url, kind, m.name);
      });
      row.appendChild(btn);
    }
    container.appendChild(row);
  } catch {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Use Load FBX / GLB / VRM, or run npm run dev to scan asset/.';
    container.appendChild(p);
  }
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('model-status');
  if (el) el.textContent = `Startup error: ${err}`;
});
