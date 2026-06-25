export interface VisemeWeights {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
}

export class LipSyncAnalyzer {
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private smoothed: VisemeWeights = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

  private readonly ATTACK = 0.3;
  private readonly RELEASE = 0.15;
  private readonly VOLUME_THRESHOLD = 0.05;

  setAnalyser(analyser: AnalyserNode | null) {
    this.analyser = analyser;
    this.dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  }

  update(delta: number): VisemeWeights {
    if (!this.analyser || !this.dataArray) {
      this.smoothToZero(delta);
      return this.smoothed;
    }

    this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
    const avgVolume = sum / this.dataArray.length / 255;

    if (avgVolume < this.VOLUME_THRESHOLD) {
      this.smoothToZero(delta);
      return this.smoothed;
    }

    const target = this.mapFrequencies(avgVolume);
    const rate = this.ATTACK;
    this.smoothed.aa = this.lerp(this.smoothed.aa, target.aa, rate);
    this.smoothed.ee = this.lerp(this.smoothed.ee, target.ee, rate);
    this.smoothed.ih = this.lerp(this.smoothed.ih, target.ih, rate);
    this.smoothed.oh = this.lerp(this.smoothed.oh, target.oh, rate);
    this.smoothed.ou = this.lerp(this.smoothed.ou, target.ou, rate);
    return this.smoothed;
  }

  private mapFrequencies(volume: number): VisemeWeights {
    if (!this.dataArray) return { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

    const len = this.dataArray.length;
    const lowEnd = Math.floor(len * 0.1);
    const lowMidEnd = Math.floor(len * 0.25);
    const midEnd = Math.floor(len * 0.5);
    const highEnd = Math.floor(len * 0.75);

    const low = this.avg(0, lowEnd) / 255;
    const lowMid = this.avg(lowEnd, lowMidEnd) / 255;
    const mid = this.avg(lowMidEnd, midEnd) / 255;
    const high = this.avg(midEnd, highEnd) / 255;
    const scale = Math.min(volume * 2, 1);

    return {
      aa: Math.min(low * 1.5 * scale, 0.8),
      oh: Math.min(lowMid * 1.3 * scale, 0.7),
      ee: Math.min(mid * 1.2 * scale, 0.6),
      ih: Math.min(high * 1.0 * scale, 0.5),
      ou: Math.min((low + lowMid) * 0.5 * scale, 0.6),
    };
  }

  private avg(start: number, end: number): number {
    if (!this.dataArray || end <= start) return 0;
    let sum = 0;
    for (let i = start; i < end && i < this.dataArray.length; i++) sum += this.dataArray[i];
    return sum / (end - start);
  }

  private smoothToZero(delta: number) {
    const rate = this.RELEASE;
    this.smoothed.aa = this.lerp(this.smoothed.aa, 0, rate);
    this.smoothed.ee = this.lerp(this.smoothed.ee, 0, rate);
    this.smoothed.ih = this.lerp(this.smoothed.ih, 0, rate);
    this.smoothed.oh = this.lerp(this.smoothed.oh, 0, rate);
    this.smoothed.ou = this.lerp(this.smoothed.ou, 0, rate);
  }

  private lerp(current: number, target: number, rate: number): number {
    return current + (target - current) * rate;
  }

  reset() {
    this.smoothed = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
  }
}

/** Procedural mouth motion when Web Speech API has no audio analyser. */
export class TalkEnvelope {
  private active = false;
  private phase = 0;

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
    this.phase = 0;
  }

  update(delta: number): VisemeWeights {
    if (!this.active) return { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

    this.phase += delta * 11;
    const jaw =
      0.28 + Math.sin(this.phase) * 0.22 + Math.sin(this.phase * 2.1) * 0.12;
    return {
      aa: jaw,
      ee: jaw * 0.35,
      ih: jaw * 0.25,
      oh: jaw * 0.4,
      ou: jaw * 0.2,
    };
  }
}
