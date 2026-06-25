import { LipSyncAnalyzer, TalkEnvelope } from './lipsync';

export type VoiceStateListener = (state: { speaking: boolean; message: string }) => void;

export class VoiceController {
  private lipSync = new LipSyncAnalyzer();
  private talkEnvelope = new TalkEnvelope();
  private useEnvelope = true;
  private speaking = false;
  private utterance: SpeechSynthesisUtterance | null = null;
  private listener: VoiceStateListener | null = null;

  setListener(listener: VoiceStateListener | null) {
    this.listener = listener;
  }

  get isSpeaking() {
    return this.speaking;
  }

  speak(text: string, rate = 1) {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.stop();

    if (!window.speechSynthesis) {
      this.notify(false, 'Web Speech API not supported in this browser');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = this.pickVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      this.speaking = true;
      this.useEnvelope = true;
      this.lipSync.setAnalyser(null);
      this.talkEnvelope.start();
      this.notify(true, 'Speaking…');
    };

    utterance.onend = () => {
      this.finish();
      this.notify(false, 'Ready');
    };

    utterance.onerror = () => {
      this.finish();
      this.notify(false, 'Speech failed');
    };

    this.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stop() {
    window.speechSynthesis?.cancel();
    this.finish();
    this.notify(false, 'Stopped');
  }

  update(delta: number) {
    if (this.useEnvelope) return this.talkEnvelope.update(delta);
    return this.lipSync.update(delta);
  }

  private finish() {
    this.speaking = false;
    this.utterance = null;
    this.talkEnvelope.stop();
    this.lipSync.reset();
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('ja') || v.lang.startsWith('en'),
    );
    return preferred ?? voices[0] ?? null;
  }

  private notify(speaking: boolean, message: string) {
    this.listener?.({ speaking, message });
  }
}
