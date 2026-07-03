import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio';

/** Apply 0–1 master volume to the Web Audio output gain node. */
export function applyMasterVolume(volume) {
  const v = Math.max(0, Math.min(1, Number(volume)));
  try {
    const controller = getSuperdoughAudioController();
    const gainParam = controller?.output?.destinationGain?.gain;
    if (!gainParam) {
      return v;
    }
    const t = getAudioContext().currentTime;
    gainParam.cancelScheduledValues(t);
    gainParam.setValueAtTime(v, t);
  } catch {
    // audio graph not ready yet
  }
  return v;
}
