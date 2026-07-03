import * as THREE from 'three';
import { readAudioAnalyser, sampleFrequencyNormalized, sampleWaveformNormalized } from '@src/repl/audio-analyser.mjs';

const LIME = 0xbfff00;
const RING_COUNT = 42;
const SEGMENTS = 128;
const TAU = Math.PI * 2;
const TILT_X = Math.PI / 8;
const INNER_R = 0.38;
const OUTER_R = 1;

function createTorusRings() {
  const group = new THREE.Group();
  group.rotation.x = TILT_X;
  const rings = [];

  for (let r = 0; r < RING_COUNT; r += 1) {
    const t = r / Math.max(1, RING_COUNT - 1);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((SEGMENTS + 1) * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.1 + t * 0.78,
    });
    const line = new THREE.LineLoop(geometry, material);
    group.add(line);
    rings.push({
      line,
      geometry,
      material,
      baseRadius: INNER_R + t * (OUTER_R - INNER_R),
      ringIndex: r,
      ringT: t,
    });
  }

  return { group, rings };
}

function yChaos(theta, ringIndex, ringT, time, sampleT, frequencies, waveform, active, energy) {
  const phase = time * 0.0016;
  const breathe = 0.025 + energy * 0.12;

  const freqSample = frequencies ? sampleFrequencyNormalized(sampleT, frequencies) : 0;
  const waveSample = waveform ? sampleWaveformNormalized(sampleT, waveform) : 0;

  const harmonic =
    Math.sin(theta * 2 + phase + ringIndex * 0.12) * 0.28 +
    Math.sin(theta * 5 - phase * 1.2 + ringT * 3) * 0.16 +
    Math.sin(theta * 9 + phase * 0.7) * 0.09;

  const audioY = active ? waveSample * 0.45 + freqSample * 0.35 : 0;
  const ringWobble = Math.sin(ringIndex * 0.35 + phase) * 0.06;

  return (harmonic * breathe + audioY * breathe * 1.4 + ringWobble) * (0.35 + ringT * 0.55);
}

function updateTorusRings(rings, time, active) {
  const { frequencies, waveform, levels } = readAudioAnalyser();
  const energy = active ? Math.min(1, levels.bass * 1.4 + levels.mid * 0.7 + levels.rms * 0.9) : 0;
  const phase = time * 0.0014;

  for (const ring of rings) {
    const positions = ring.geometry.attributes.position.array;
    const { baseRadius, ringIndex, ringT } = ring;
    const radialJitter = 0.012 + energy * 0.035;

    for (let i = 0; i <= SEGMENTS; i += 1) {
      const theta = (i / SEGMENTS) * TAU;
      const sampleT = i / SEGMENTS;
      const y = yChaos(theta, ringIndex, ringT, time, sampleT, frequencies, waveform, active, energy);

      const radialWave =
        Math.sin(theta * 4 + phase + ringIndex * 0.08) * radialJitter +
        (active && frequencies ? sampleFrequencyNormalized(sampleT, frequencies) * radialJitter * 0.6 : 0);
      const radius = baseRadius + radialWave;

      const idx = i * 3;
      positions[idx] = Math.cos(theta) * radius;
      positions[idx + 1] = y;
      positions[idx + 2] = Math.sin(theta) * radius;
    }

    ring.geometry.attributes.position.needsUpdate = true;
    ring.material.opacity = active ? 0.1 + ringT * 0.78 + energy * 0.12 : 0.08 + ringT * 0.4;
  }
}

export function createWavyRingScene(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.55, 3.1);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  container.append(renderer.domElement);

  const { group, rings } = createTorusRings();
  scene.add(group);

  const resize = (width, height) => {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const tick = (time, active) => {
    updateTorusRings(rings, time, active);
    group.rotation.y = TILT_X * 0.25 + time * 0.00022;
    renderer.render(scene, camera);
  };

  const dispose = () => {
    for (const ring of rings) {
      ring.geometry.dispose();
      ring.material.dispose();
    }
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { resize, tick, dispose };
}
