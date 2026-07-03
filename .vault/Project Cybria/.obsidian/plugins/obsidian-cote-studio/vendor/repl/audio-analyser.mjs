import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio';

let analyser = null;
let freqData = null;
let timeData = null;
let tapConnected = false;

function ensureAnalyser() {
  const ctx = getAudioContext();
  if (!analyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  if (!tapConnected) {
    try {
      const gain = getSuperdoughAudioController()?.output?.destinationGain;
      if (gain) {
        gain.connect(analyser);
        tapConnected = true;
      }
    } catch {
      // audio graph not ready
    }
  }
  return analyser;
}

function bandAverage(data, start, end) {
  if (!data?.length) {
    return 0;
  }
  const from = Math.max(0, Math.floor(start));
  const to = Math.min(data.length, Math.ceil(end));
  if (to <= from) {
    return 0;
  }
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    sum += data[i];
  }
  return sum / (to - from) / 255;
}

export function readAudioAnalyser() {
  const node = ensureAnalyser();
  if (!tapConnected || !freqData || !timeData) {
    return {
      frequencies: null,
      waveform: null,
      levels: { bass: 0, mid: 0, treble: 0, rms: 0 },
    };
  }
  node.getByteFrequencyData(freqData);
  node.getByteTimeDomainData(timeData);

  let sumSq = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const v = (timeData[i] - 128) / 128;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / timeData.length);

  const len = freqData.length;
  return {
    frequencies: freqData,
    waveform: timeData,
    levels: {
      bass: bandAverage(freqData, 0, len * 0.08),
      mid: bandAverage(freqData, len * 0.08, len * 0.35),
      treble: bandAverage(freqData, len * 0.35, len),
      rms,
    },
  };
}

/** Sample FFT magnitude at normalized position 0..1 (wraps safely). */
export function sampleFrequencyNormalized(t, frequencies = readAudioAnalyser().frequencies) {
  if (!frequencies?.length) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, t));
  const index = Math.min(frequencies.length - 1, Math.floor(clamped * frequencies.length));
  return frequencies[index] / 255;
}

/** Sample time-domain waveform at normalized position 0..1. */
export function sampleWaveformNormalized(t, waveform = readAudioAnalyser().waveform) {
  if (!waveform?.length) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, t));
  const index = Math.min(waveform.length - 1, Math.floor(clamped * waveform.length));
  return (waveform[index] - 128) / 128;
}

function freqBinToMidi(binIndex, binCount, sampleRate, fftSize) {
  const nyquist = sampleRate / 2;
  const freq = (binIndex / binCount) * nyquist;
  if (freq < 20) {
    return -1;
  }
  return 69 + 12 * Math.log2(freq / 440);
}

/** Average FFT magnitude for bins whose MIDI note falls in [noteMin, noteMax]. */
export function sampleMidiRangeEnergy(
  noteMin,
  noteMax,
  frequencies = readAudioAnalyser().frequencies,
) {
  if (!frequencies?.length) {
    return 0;
  }
  const ctx = getAudioContext();
  const binCount = frequencies.length;
  const fftSize = analyser?.fftSize ?? 512;
  const sampleRate = ctx.sampleRate;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < binCount; i += 1) {
    const midi = freqBinToMidi(i, binCount, sampleRate, fftSize);
    if (midi >= noteMin && midi <= noteMax) {
      sum += frequencies[i];
      count += 1;
    }
  }
  return count > 0 ? sum / count / 255 : 0;
}
