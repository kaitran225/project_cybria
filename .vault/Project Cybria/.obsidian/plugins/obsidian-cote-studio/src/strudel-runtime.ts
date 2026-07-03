import { evalScope } from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import {
  initAudioOnFirstClick,
  registerSynthSounds,
  samples,
  webaudioRepl,
} from "@strudel/webaudio";

type ReplInstance = ReturnType<typeof webaudioRepl>;

let repl: ReplInstance | null = null;
let audioReady: Promise<void> | null = null;
let scopeReady: Promise<void> | null = null;
let playing = false;

const SAMPLE_CDN = "https://strudel.b-cdn.net";

async function ensureScope(): Promise<void> {
  if (!scopeReady) {
    scopeReady = evalScope(
      import("@strudel/core"),
      import("@strudel/mini"),
      import("@strudel/webaudio"),
      import("@strudel/tonal")
    ).then(() => undefined);
  }
  await scopeReady;
}

async function ensureAudio(): Promise<ReplInstance> {
  await ensureScope();

  if (!audioReady) {
    audioReady = (async () => {
      await initAudioOnFirstClick();
      await registerSynthSounds();
      await samples(`${SAMPLE_CDN}/tidal-drum-machines.json`, `${SAMPLE_CDN}/tidal-drum-machines/machines/`, {
        prebake: true,
        tag: "drum-machines",
      });
    })();
  }
  await audioReady;

  if (!repl) {
    repl = webaudioRepl({ transpiler });
  }
  return repl;
}

export async function playPattern(code: string): Promise<void> {
  const instance = await ensureAudio();
  instance.stop();
  instance.setCode(code);
  await instance.evaluate();
  instance.start();
  playing = true;
}

export async function stopPattern(): Promise<void> {
  repl?.stop();
  playing = false;
}

export async function togglePattern(code: string): Promise<boolean> {
  if (playing) {
    await stopPattern();
    return false;
  }
  await playPattern(code);
  return true;
}
