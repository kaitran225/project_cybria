/*
Repl.jsx - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/repl/src/App.js>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { code2hash, getPerformanceTimeSeconds, logger, silence } from '@strudel/core';
import { cleanupDraw } from '@strudel/draw';
import { transpiler, evaluate } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  renderPatternAudio,
  webaudioOutput,
  resetGlobalEffects,
  resetLoadedSounds,
  initAudioOnFirstClick,
  resetDefaults,
  initAudio,
} from '@strudel/webaudio';
import { setVersionDefaultsFrom } from './util.mjs';
import { StrudelMirror, defaultSettings } from '@strudel/codemirror';
import { clearHydra } from '@strudel/hydra';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudioSaveShortcut } from '@kvi/shell';
import { parseBoolean, settingsMap, useSettings, setPianorollView } from '../settings.mjs';
import {
  setActivePattern,
  setLatestCode,
  createPatternID,
  userPattern,
  getViewingPatternData,
  setViewingPatternData,
} from '../user_pattern_utils.mjs';
import { superdirtOutput } from '@strudel/osc/superdirtoutput';
import { audioEngineTargets } from '../settings.mjs';
import { useStore } from '@nanostores/react';
import { prebake } from './prebake.mjs';
import { getRandomTune, initCode, loadModules } from './util.mjs';
import './Repl.css';
import { setInterval, clearInterval } from 'worker-timers';
import { getMetadata } from '../metadata_parser';
import { debugAudiograph } from './audiograph.mjs';
import {
  applyPianorollViewToEditor,
  isPianorollViewEnabled,
  PIANOROLL_DRAW_TIME,
  resolveDrawContext,
  togglePianorollView,
  wrapPatternWithPianoroll,
} from './pianoroll-view.mjs';
import {
  flushPatternSave,
  schedulePatternSave,
  savePatternToDisk,
  cancelPendingPatternSave,
  isTransientPatternCode,
  markPatternSaved,
  setPatternSaveEnabled,
} from '../pattern-save.mjs';
import { isStudioProjectPatterns } from '../project-patterns.mjs';

const { latestCode, maxPolyphony, audioDeviceName, multiChannelOrbits } = settingsMap.get();
let modulesLoading, presets, audioReady;

if (typeof window !== 'undefined') {
  audioReady = initAudioOnFirstClick({
    maxPolyphony,
    audioDeviceName,
    multiChannelOrbits: parseBoolean(multiChannelOrbits),
  });
  modulesLoading = loadModules();
  presets = prebake();
}

async function getModule(name) {
  if (!modulesLoading) {
    return;
  }
  const modules = await modulesLoading;
  return modules.find((m) => m.packageName === name);
}

function resolveInitialEditorCode() {
  const viewing = getViewingPatternData();
  if (
    isStudioProjectPatterns() &&
    userPattern.isValidID(viewing?.id) &&
    viewing.code &&
    !isTransientPatternCode(viewing.code)
  ) {
    return viewing.code;
  }
  return '';
}

export function useReplContext() {
  const { isSyncEnabled, audioEngineTarget, prebakeScript } = useSettings();
  const shouldUseWebaudio = audioEngineTarget !== audioEngineTargets.osc;
  const defaultOutput = shouldUseWebaudio ? webaudioOutput : superdirtOutput;
  const getTime = shouldUseWebaudio ? getAudioContextCurrentTime : getPerformanceTimeSeconds;
  const init = useCallback(() => {
    setPatternSaveEnabled(false);
    cancelPendingPatternSave();

    setActivePattern(getViewingPatternData().id);
    const drawTime = isPianorollViewEnabled() ? PIANOROLL_DRAW_TIME : [-2, 2];
    const drawContext = resolveDrawContext();
    const editor = new StrudelMirror({
      sync: isSyncEnabled,
      defaultOutput,
      getTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      editPattern: (pat) => wrapPatternWithPianoroll(pat),
      root: containerRef.current,
      initialCode: resolveInitialEditorCode(),
      pattern: silence,
      drawTime,
      drawContext,
      prebake: async () => {
        await Promise.all([modulesLoading, presets]);
        if (prebakeScript) {
          return evaluate(prebakeScript, { addReturn: false });
        }
      },
      onUpdateState: (state) => {
        setReplState({ ...state });
        if (state.code) {
          schedulePatternSave(state.code);
        }
      },
      onToggle: (playing) => {
        if (!playing) {
          clearHydra();
        }
      },
      beforeEval: () => audioReady,
      afterEval: (all) => {
        const { code } = all;
        const fullBufferCode = editorRef.current?.code || code;
        if (isTransientPatternCode(fullBufferCode)) {
          return;
        }
        //post to iframe parent (like Udels) if it exists...
        window.parent?.postMessage(code);

        // Get the full buffer content from the editor instead of just the evaluated block
        setLatestCode(fullBufferCode);

        try {
          window.location.hash = '#' + code2hash(fullBufferCode);
        } catch (e) {
          console.warn('[useReplContext] Failed to update hash:', e.message);
        }
        setDocumentTitle(fullBufferCode);
        const viewingPatternData = getViewingPatternData();
        setVersionDefaultsFrom(fullBufferCode);
        const data = { ...viewingPatternData, code: fullBufferCode };
        let id = data.id;
        const isExamplePattern = viewingPatternData.collection !== userPattern.collection;

        if (isExamplePattern) {
          const codeHasChanged = fullBufferCode !== viewingPatternData.code;
          if (codeHasChanged) {
            // fork example
            const newPattern = userPattern.duplicate(data);
            id = newPattern.id;
            setViewingPatternData(newPattern.data);
          }
        } else {
          id = userPattern.isValidID(id) ? id : createPatternID();
          const updated = userPattern.update(id, data, { persistToDisk: false });
          setViewingPatternData(updated.data);
          void savePatternToDisk(fullBufferCode, { force: true, id });
        }
        setActivePattern(id);
      },
      bgFill: false,
    });
    window.strudelMirror = editor;
    window.debugAudiograph = debugAudiograph;

    // init settings
    initCode().then(async (decoded) => {
      let code, msg;
      const viewing = getViewingPatternData();
      const sessionCode = settingsMap.get().latestCode;

      if (decoded) {
        code = decoded;
        msg = `I have loaded the code from the URL.`;
      } else if (
        isStudioProjectPatterns() &&
        userPattern.isValidID(viewing?.id) &&
        viewing.code &&
        !isTransientPatternCode(viewing.code)
      ) {
        code = viewing.code;
        msg = `Loaded pattern "${viewing.id}".`;
      } else if (sessionCode && !isTransientPatternCode(sessionCode)) {
        code = sessionCode;
        msg = `Your last session has been loaded!`;
      } else {
        code = '$: s("[bd <hh oh>]*2").bank("tr909").dec(.4)';
        msg = `Default code has been loaded`;
      }
      editor.setCode(code);
      setDocumentTitle(code);
      if (isStudioProjectPatterns() && userPattern.isValidID(viewing?.id)) {
        markPatternSaved(viewing.id, code);
      }
      setPatternSaveEnabled(true);
      logger(`Welcome to Strudel! ${msg} Press play or hit ctrl+enter to run it!`, 'highlight');
    });

    editorRef.current = editor;
    if (isPianorollViewEnabled()) {
      requestAnimationFrame(() => applyPianorollViewToEditor(editor, true));
    }
  }, []);

  const [replState, setReplState] = useState({});
  const { started, isDirty, error, activeCode, pending } = replState;
  const editorRef = useRef();
  const containerRef = useRef();

  // this can be simplified once SettingsTab has been refactored to change codemirrorSettings directly!
  // this will be the case when the main repl is being replaced
  const _settings = useStore(settingsMap, { keys: Object.keys(defaultSettings) });
  useEffect(() => {
    let editorSettings = {};
    Object.keys(defaultSettings).forEach((key) => {
      // Don't use hasOwnProperty - nanostore uses proxies so values may not be own properties
      editorSettings[key] = _settings[key];
    });
    editorRef.current?.updateSettings(editorSettings);
  }, [_settings]);

  useEffect(() => {
    const enabled = parseBoolean(_settings.pianorollView);
    const frame = requestAnimationFrame(() => {
      applyPianorollViewToEditor(editorRef.current, enabled);
    });
    return () => cancelAnimationFrame(frame);
  }, [_settings.pianorollView]);

  useEffect(() => {
    const anyWidget =
      parseBoolean(_settings.replWidgetViz) ||
      parseBoolean(_settings.replWidgetSpectrum) ||
      parseBoolean(_settings.replWidgetPiano);
    if (!anyWidget && parseBoolean(_settings.pianorollView)) {
      setPianorollView(false);
    }
  }, [_settings.replWidgetViz, _settings.replWidgetSpectrum, _settings.replWidgetPiano, _settings.pianorollView]);

  //
  // UI Actions
  //

  const setDocumentTitle = (code) => {
    const meta = getMetadata(code);
    document.title = (meta.title ? `${meta.title} - ` : '') + 'Strudel REPL';
  };

  const handleTogglePlay = async () => {
    editorRef.current?.toggle();
  };

  const resetEditor = async () => {
    (await getModule('@strudel/tonal'))?.resetVoicings();
    resetDefaults();
    resetGlobalEffects();
    cleanupDraw(true, editorRef.current?.id);
    clearHydra();
    resetLoadedSounds();
    editorRef.current.repl.setCps(0.5);
    await prebake(); // declare default samples
  };

  const handleUpdate = async (patternData, reset = false) => {
    const currentCode = editorRef.current?.code;
    if (currentCode) {
      await flushPatternSave(currentCode);
    }
    if (editorRef.current?.repl?.state?.started) {
      editorRef.current.stop();
    }
    cancelPendingPatternSave();
    setViewingPatternData(patternData);
    editorRef.current.setCode(patternData.code);
    if (isStudioProjectPatterns() && userPattern.isValidID(patternData?.id)) {
      markPatternSaved(patternData.id, patternData.code);
    }
    if (reset) {
      await resetEditor();
      handleEvaluate();
    }
  };

  const handleEvaluate = () => {
    editorRef.current.evaluate();
  };

  const handleSavePattern = useCallback(() => {
    const code = editorRef.current?.code ?? '';
    return flushPatternSave(code);
  }, []);

  useStudioSaveShortcut(handleSavePattern, true);

  const handleExport = async (begin, end, sampleRate, maxPolyphony, multiChannelOrbits, downloadName = undefined) => {
    await editorRef.current.evaluate(false);
    editorRef.current.repl.scheduler.stop();
    await renderPatternAudio(
      editorRef.current.repl.state.pattern,
      editorRef.current.repl.scheduler.cps,
      begin,
      end,
      sampleRate,
      maxPolyphony,
      multiChannelOrbits,
      downloadName,
    ).finally(async () => {
      const { latestCode, maxPolyphony, audioDeviceName, multiChannelOrbits } = settingsMap.get();
      await initAudio({
        latestCode,
        maxPolyphony,
        audioDeviceName,
        multiChannelOrbits,
      });
      editorRef.current.repl.scheduler.stop();
    });
  };
  const handleShuffle = async () => {
    const patternData = await getRandomTune();
    const code = patternData.code;
    logger(`[repl] ✨ loading random tune "${patternData.id}"`);
    setActivePattern(patternData.id);
    setViewingPatternData(patternData);
    await resetEditor();
    editorRef.current.setCode(code);
    editorRef.current.repl.evaluate(code);
  };

  const handleTogglePianoroll = () => {
    togglePianorollView();
  };

  const context = {
    started,
    pending,
    isDirty,
    activeCode,
    handleTogglePlay,
    handleUpdate,
    handleShuffle,
    handleEvaluate,
    handleSavePattern,
    handleTogglePianoroll,
    handleExport,
    init,
    error,
    editorRef,
    containerRef,
  };
  return context;
}
