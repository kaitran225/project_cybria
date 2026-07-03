import useEvent from '@src/useEvent.mjs';
import { useStore } from '@nanostores/react';
import { getAudioContext, soundMap, connectToDestination } from '@strudel/webaudio';
import { useMemo, useRef, useState } from 'react';
import { settingsMap, soundFilterType, useSettings } from '../../../settings.mjs';
import { ButtonGroup } from './Forms.jsx';
import ImportSoundsButton from './ImportSoundsButton.jsx';
import { Textbox } from '@src/repl/components/panel/SettingsTab.jsx';
import { ActionButton } from '../button/action-button.jsx';
import { confirmDialog } from '@src/repl/util.mjs';
import { clearIDB, userSamplesDBConfig } from '@src/repl/idbutils.mjs';
import { prebake } from '@src/repl/prebake.mjs';
import { useCoteEmbedded } from '@src/cote-embedded.mjs';
import { ShellButton } from './ShellForms.jsx';
import { coteDocsPath } from '@src/strudel-docs.mjs';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  PlayIcon,
} from '@heroicons/react/16/solid';
import { isTauri } from '@src/tauri.mjs';
import cx from '@src/cx.mjs';

const getSamples = (samples) =>
  Array.isArray(samples) ? samples.length : typeof samples === 'object' ? Object.values(samples).length : 1;

function getSampleKeys(samples) {
  if (Array.isArray(samples)) return samples.map((_, i) => String(i));
  if (samples && typeof samples === 'object') return Object.keys(samples);
  return [];
}

function getSampleSource(data) {
  if (data?.type === 'sample') return data.samples;
  if (data?.type === 'wavetable') return data.tables;
  return null;
}

function soundSnippet(name, sampleKey) {
  if (sampleKey === undefined || sampleKey === null) {
    return `s("${name}")`;
  }
  return `n("${sampleKey}").s("${name}")`;
}

async function copyText(text) {
  try {
    if (isTauri()) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch (err) {
    console.warn('copy failed', err);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function triggerSoundPreview(onTrigger, sampleIndex, trigRef, data, name) {
  const ctx = getAudioContext();
  const n = sampleIndex === undefined || sampleIndex === null ? 0 : Number(sampleIndex);
  const params = {
    note: ['synth', 'soundfont'].includes(data.type) ? 'a3' : undefined,
    s: name,
    n,
    clip: 1,
    release: 0.5,
    sustain: 1,
    duration: 0.5,
  };
  const onended = () => trigRef.current?.node?.disconnect();
  let errMsg;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const time = ctx.currentTime + 0.05;
      const ref = await onTrigger(time, params, onended);
      trigRef.current = ref;
      if (ref?.node) {
        connectToDestination(ref.node);
        break;
      }
    } catch (err) {
      errMsg = err;
    }
    if (attempt == 9) {
      console.warn('Failed to trigger sound after 10 attempts' + (errMsg ? `: ${errMsg}` : ''));
    } else {
      await wait(200);
    }
  }
}

function SoundRowEmbedded({ name, data, onTrigger, trigRef }) {
  const [expanded, setExpanded] = useState(false);
  const sampleSource = getSampleSource(data);
  const sampleKeys = sampleSource ? getSampleKeys(sampleSource) : [];
  const hasSubs = sampleKeys.length > 1;

  const meta =
    data?.type === 'sample'
      ? `${getSamples(data.samples)} samples`
      : data?.type === 'wavetable'
        ? `${getSamples(data.tables)} tables`
        : data?.type === 'soundfont'
          ? `${data.fonts.length} fonts`
          : data?.type ?? '';

  const play = (sampleKey) => {
    const index = sampleKey === undefined ? 0 : Number(sampleKey);
    triggerSoundPreview(onTrigger, index, trigRef, data, name);
  };

  return (
    <div className="cote-shell-sound-row">
      <div className="cote-shell-sound-row__main">
        <button
          type="button"
          className="cote-shell-sound-row__btn"
          title="Play"
          aria-label={`Play ${name}`}
          onClick={() => play()}
        >
          <PlayIcon />
        </button>
        <div className="cote-shell-sound-row__body">
          <span className="cote-shell-list__title">{name}</span>
          {meta ? <span className="cote-shell-list__meta">{meta}</span> : null}
        </div>
        <div className="cote-shell-sound-row__actions">
          <button
            type="button"
            className="cote-shell-sound-row__btn"
            title="Copy pattern snippet"
            aria-label={`Copy s("${name}")`}
            onClick={() => copyText(soundSnippet(name))}
          >
            <ClipboardDocumentIcon />
          </button>
          {hasSubs ? (
            <button
              type="button"
              className={cx('cote-shell-sound-row__btn', expanded && 'cote-shell-sound-row__btn--expanded')}
              title={expanded ? 'Hide sub-samples' : 'Show sub-samples'}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
          ) : null}
        </div>
      </div>
      {expanded && hasSubs ? (
        <div className="cote-shell-sound-row__subs">
          {sampleKeys.map((key) => (
            <div key={key} className="cote-shell-sound-row__sub">
              <span className="cote-shell-sound-row__sub-key">{key}</span>
              <span className="cote-shell-sound-row__sub-snippet">{soundSnippet(name, key)}</span>
              <button
                type="button"
                className="cote-shell-sound-row__btn"
                title="Play"
                aria-label={`Play ${name} ${key}`}
                onClick={() => play(key)}
              >
                <PlayIcon />
              </button>
              <button
                type="button"
                className="cote-shell-sound-row__btn"
                title="Copy"
                aria-label={`Copy ${soundSnippet(name, key)}`}
                onClick={() => copyText(soundSnippet(name, key))}
              >
                <ClipboardDocumentIcon />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SoundRowLegacy({ name, data, onTrigger, numRef, trigRef }) {
  return (
    <span
      className="cursor-pointer hover:opacity-50"
      onMouseDown={() => triggerSoundPreview(onTrigger, numRef.current, trigRef, data, name)}
    >
      {name}
      {data?.type === 'sample' ? `(${getSamples(data.samples)})` : ''}
      {data?.type === 'wavetable' ? `(${getSamples(data.tables)})` : ''}
      {data?.type === 'soundfont' ? `(${data.fonts.length})` : ''}
    </span>
  );
}

export function SoundsTab() {
  const sounds = useStore(soundMap);
  const embedded = useCoteEmbedded();

  const { soundsFilter } = useSettings();
  const [search, setSearch] = useState('');

  const soundEntries = useMemo(() => {
    if (!sounds) {
      return [];
    }

    let filtered = Object.entries(sounds)
      .filter(([key]) => !key.startsWith('_'))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()));

    if (soundsFilter === soundFilterType.USER) {
      return filtered.filter(([_, { data }]) => !data.prebake);
    }
    if (soundsFilter === soundFilterType.DRUMS) {
      return filtered.filter(([_, { data }]) => data.type === 'sample' && data.tag === 'drum-machines');
    }
    if (soundsFilter === soundFilterType.SAMPLES) {
      return filtered.filter(([_, { data }]) => data.type === 'sample' && data.tag !== 'drum-machines');
    }
    if (soundsFilter === soundFilterType.SYNTHS) {
      return filtered.filter(([_, { data }]) => ['synth', 'soundfont'].includes(data.type));
    }
    if (soundsFilter === soundFilterType.WAVETABLES) {
      return filtered.filter(([_, { data }]) => data.type === 'wavetable');
    }
    if (soundsFilter === 'importSounds') {
      return [];
    }
    return filtered;
  }, [sounds, soundsFilter, search]);

  const trigRef = useRef();
  const numRef = useRef(0);

  useEvent('mouseup', () => {
    const ref = trigRef.current;
    trigRef.current = undefined;
    ref?.stop?.(getAudioContext().currentTime + 0.01);
  });
  useEvent('keydown', (e) => {
    if (!embedded && !isNaN(Number(e.key))) {
      numRef.current = Number(e.key);
    }
  });
  useEvent('keyup', () => {
    if (!embedded) {
      numRef.current = 0;
    }
  });

  return (
    <div
      id="sounds-tab"
      className={embedded ? 'cote-shell-tab-panel flex flex-col w-full h-full' : 'flex flex-col w-full h-full text-foreground'}
    >
      <div className={embedded ? 'cote-shell-tab-panel__search' : 'w-full'}>
        <Textbox placeholder="Search sounds…" className={embedded ? undefined : 'border-0'} value={search} onChange={(v) => setSearch(v)} />
      </div>

      <div className={embedded ? 'cote-shell-tab-panel__toolbar' : 'flex shrink-0 flex-wrap border-y border-muted'}>
        <ButtonGroup
          wrap
          value={soundsFilter}
          onChange={(value) => settingsMap.setKey('soundsFilter', value)}
          items={{
            samples: 'samples',
            drums: 'drum-machines',
            synths: 'Synths',
            wavetables: 'Wavetables',
            user: 'User',
            importSounds: 'import-sounds',
          }}
        />
      </div>

      {soundsFilter === soundFilterType.USER && soundEntries.length > 0 &&
        (embedded ? (
          <ShellButton
            className="m-2"
            label="Delete all"
            variant="danger"
            onClick={async () => {
              try {
                const confirmed = await confirmDialog('Delete all imported user samples?');
                if (confirmed) {
                  clearIDB(userSamplesDBConfig.dbName);
                  soundMap.set({});
                  await prebake();
                }
              } catch (e) {
                console.error(e);
              }
            }}
          />
        ) : (
          <ActionButton
            className="pl-2"
            label="delete-all"
            onClick={async () => {
              try {
                const confirmed = await confirmDialog('Delete all imported user samples?');
                if (confirmed) {
                  clearIDB(userSamplesDBConfig.dbName);
                  soundMap.set({});
                  await prebake();
                }
              } catch (e) {
                console.error(e);
              }
            }}
          />
        ))}

      <div className={embedded ? 'cote-shell-tab-panel__body' : 'min-h-0 max-h-full grow overflow-auto break-normal p-2'}>
        {embedded ? (
          <div className="cote-shell-list">
            {soundEntries.map(([name, { data, onTrigger }]) => (
              <SoundRowEmbedded key={name} name={name} data={data} onTrigger={onTrigger} trigRef={trigRef} />
            ))}
          </div>
        ) : (
          soundEntries.map(([name, { data, onTrigger }]) => (
            <SoundRowLegacy key={name} name={name} data={data} onTrigger={onTrigger} numRef={numRef} trigRef={trigRef} />
          ))
        )}
        {!soundEntries.length && soundsFilter === 'importSounds' ? (
          <div className={embedded ? 'cote-shell-settings text-sm space-y-3 p-2' : 'prose dark:prose-invert min-w-full text-sm'}>
            <ImportSoundsButton onComplete={() => settingsMap.setKey('soundsFilter', 'user')} />
            <p>
              To import sounds into strudel, they must be contained{' '}
              <a href={coteDocsPath('learn/samples', '#from-disk-via-import-sounds-folder')}>
                within a folder or subfolder
              </a>
              . The best way to do this is to upload a “samples” folder containing subfolders of individual sounds or
              soundbanks (see diagram below).{' '}
            </p>
            <pre className={embedded ? 'cote-shell-input font-mono text-xs p-2' : 'bg-background'} key={'sample-diagram'}>
              {`└─ samples <-- import this folder
   ├─ swoop
   │  ├─ swoopshort.wav
   │  ├─ swooplong.wav
   │  └─ swooptight.wav
   └─ smash
      ├─ smashhigh.wav
      ├─ smashlow.wav
      └─ smashmiddle.wav`}
            </pre>
            <p>
              The name of a subfolder corresponds to the sound name under the “user” tab. Multiple samples within a
              subfolder are all labelled with the same name, but can be accessed using “.n( )” - remember sounds are
              zero-indexed and in alphabetical order!
            </p>
            <p>
              For more information, and other ways to use your own sounds in strudel,{' '}
              <a href={coteDocsPath('learn/samples', '#from-disk-via-import-sounds-folder')}>
                check out the docs
              </a>
              !
            </p>
            <h3>Preview Sounds</h3>
            <pre className={embedded ? 'cote-shell-input font-mono text-xs p-2' : 'bg-background'} key={'sample-preview'}>
              n("0 1 2 3 4 5").s("sample-name")
            </pre>
            <p>
              Paste the line above into the main editor to hear the uploaded folder. Remember to use the name of your
              sample as it appears under the "user" tab.
            </p>
          </div>
        ) : (
          ''
        )}
        {!soundEntries.length && soundsFilter !== 'importSounds'
          ? embedded ? (
              <p className="cote-shell-list__empty">{search === '' ? 'No sounds loaded' : 'No sounds found'}</p>
            ) : search == ''
              ? 'No sounds loaded'
              : 'No sounds found'
          : ''}
      </div>
    </div>
  );
}
