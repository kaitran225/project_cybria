import { useEffect } from 'react';
import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/16/solid';
import cx from '@src/cx.mjs';
import { applyMasterVolume } from '@src/master-volume.mjs';
import { setMasterVolume, useSettings } from '../../../settings.mjs';

export function ShellVolumeControl({ className }) {
  const { masterVolume } = useSettings();
  const volume = Number.isFinite(masterVolume) ? masterVolume : 1;
  const muted = volume <= 0.01;

  useEffect(() => {
    applyMasterVolume(volume);
  }, [volume]);

  return (
    <label
      className={cx('cote-shell-controls__volume', className)}
      title={`Volume ${Math.round(volume * 100)}%`}
    >
      <span className="cote-shell-controls__volume-icon" aria-hidden>
        {muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
      </span>
      <input
        type="range"
        className="cote-shell-controls__volume-slider"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setMasterVolume(Number(e.target.value))}
        aria-label="Master volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
      />
    </label>
  );
}
