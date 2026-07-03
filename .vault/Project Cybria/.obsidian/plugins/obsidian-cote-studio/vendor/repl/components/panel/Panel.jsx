import { ArrowDownTrayIcon, ArrowPathIcon, Bars3Icon, PlayIcon, Squares2X2Icon, StopIcon, XMarkIcon } from '@heroicons/react/16/solid';
import cx from '@src/cx.mjs';
import { useCoteEmbedded } from '@src/cote-embedded.mjs';
import { isStudioProjectPatterns } from '@src/project-patterns.mjs';
import { usePatternSaveState } from '@src/pattern-save.mjs';
import { StudioSaveStatusChip } from '@kvi/shell';
import { StrudelIcon } from '@src/repl/components/icons/StrudelIcon';
import { useSettings, setIsZen, setIsPanelOpened, setActiveFooter as setTab, setPianorollView, setReplWidgetViz, setReplWidgetSpectrum, setReplWidgetPiano } from '../../../settings.mjs';
import { GridIcon, PianoIcon, RingIcon } from '@src/repl/components/pianoroll/ReplBentoWidget.jsx';
import '../../Repl.css';
import { useLogger } from '../useLogger';
import { ConsoleTab } from './ConsoleTab';
import ExportTab from './ExportTab';
import { FilesTab } from './FilesTab';
import { PatternsTab } from './PatternsTab';
import { Reference } from './Reference';
import { SettingsTab } from './SettingsTab';
import { SoundsTab } from './SoundsTab';
import { ShellVolumeControl } from './ShellVolumeControl';
import { Link } from 'react-router-dom';
import { coteDocsPath } from '@src/strudel-docs.mjs';

const TAURI = typeof window !== 'undefined' && window.__TAURI__;

export function LogoButton({ context, isEmbedded }) {
  const { started } = context;
  const { isZen, isCSSAnimationDisabled, fontFamily } = useSettings();
  return (
    <div
      className={cx(
        'mt-[1px]',
        started && !isCSSAnimationDisabled && 'animate-spin',
        'cursor-pointer text-blue-500',
        isZen && 'fixed top-2 right-4',
      )}
      onClick={() => {
        if (!isEmbedded) {
          setIsZen(!isZen);
        }
      }}
    >
      <span className="block text-foreground rotate-90">
        <StrudelIcon className="w-5 h-5 fill-foreground" />
      </span>
    </div>
  );
}

export function MainPanel({ context, isEmbedded = false, shellHeader = false, className }) {
  if (shellHeader) {
    return null;
  }
  const { isZen, isButtonRowHidden, fontFamily } = useSettings();
  let loc = window.location;
  let ver = 'unofficial';
  let hot = false;
  let b = loc.hostname.match(/^(.+)\.(strudel)/);
  if (/(strudel.cc$)/.test(loc.hostname)) {
    // if there's no text before 'strudel', it's warm, otherwise use the text before strudel
    ver = b ? b[1] : 'warm';
  } else {
    // match both versions of localhost
    if (/(localhost)|(127.0.0.1)/.test(loc.hostname)) ver = 'dev';
  }
  let pr = ver.match(/pr-([0-9]+)/);
  if (pr) {
    pr = pr[1];
    ver = `hot: ${pr}`;
    hot = true;
    pr = `https://codeberg.org/uzu/strudel/pulls/${pr}`;
  }

  return (
    <nav
      id="header"
      className={cx(
        'flex-none text-black z-[100] text-sm select-none min-h-10 max-h-10',
        !isZen && !isEmbedded && 'border-b border-muted bg-lineHighlight',
        isZen ? 'h-12 w-8 fixed top-0 left-0' : '',
        'flex items-center',
        className,
      )}
      style={{ fontFamily }}
    >
      <div className={cx('flex w-full justify-between')}>
        <div className="px-3 py-1 flex space-x-2 select-none">
          <h1
            onClick={() => {
              if (isEmbedded) window.open(window.location.href.replace('embed', ''));
            }}
            className={cx(
              isEmbedded ? 'text-l cursor-pointer' : 'text-xl',
              'text-foreground font-bold flex space-x-2 items-center',
            )}
          >
            <LogoButton context={context} isEmbedded={isEmbedded} />
            {!isZen && (
              <div className="space-x-2 flex items-baseline">
                <span className="hidden sm:block">strudel</span>
                <span className="text-sm font-medium hidden sm:block">REPL</span>
                {!hot ? (
                  <span className="text-sm font-medium hidden sm:block">({ver})</span>
                ) : (
                  <a className="hover:opacity-50" href={pr} target="_blank">
                    <span className="text-sm font-medium hidden sm:block">({ver})</span>
                  </a>
                )}
              </div>
            )}
          </h1>
        </div>
        {!isZen && (
          <div className="flex grow justify-end">
            {!isButtonRowHidden && <MainMenu isEmbedded={isEmbedded} context={context} />}
            <PanelToggle isEmbedded={isEmbedded} isZen={isZen} />
          </div>
        )}
      </div>
    </nav>
  );
}

export function Footer({ context, isEmbedded = false }) {
  return (
    <div className="border-t border-muted bg-lineHighlight block lg:hidden">
      <MainMenu context={context} isEmbedded={isEmbedded} />
    </div>
  );
}

function MainMenu({ context, isEmbedded = false, shellHeader = false, className }) {
  if (shellHeader) {
    return <ShellReplControls context={context} className={className} />;
  }
  const { started, pending, isDirty, activeCode, handleTogglePlay, handleEvaluate } = context;
  const { isCSSAnimationDisabled } = useSettings();
  const showLabels = !isEmbedded;
  return (
    <div className={cx('flex text-sm max-w-full shrink-0 overflow-hidden text-foreground px-2 h-10', className)}>
      <button
        onClick={handleTogglePlay}
        title={started ? 'stop' : 'play'}
        className={cx('px-2 hover:opacity-50', !started && !isCSSAnimationDisabled && 'animate-pulse')}
      >
        <span className={cx('flex items-center space-x-2')}>
          {started ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          {showLabels && <span>{pending ? '...' : started ? 'stop' : 'play'}</span>}
        </span>
      </button>
      <button
        onClick={handleEvaluate}
        title="update"
        className={cx('flex items-center space-x-1 px-2', !isDirty || !activeCode ? 'opacity-50' : 'hover:opacity-50')}
      >
        {showLabels && <span>update</span>}
      </button>
      {showLabels && (
        <Link
          title="learn"
          to={coteDocsPath('workshop/getting-started')}
          className={cx('hover:opacity-50 flex items-center space-x-1', showLabels ? 'p-2' : 'px-2')}
        >
          <span>learn</span>
        </Link>
      )}
    </div>
  );
}

/** KVI Studio shell header — uses shell.css tokens, not Strudel tailwind. */
function PatternSaveStatus({ className }) {
  const { status, error } = usePatternSaveState();

  if (!isStudioProjectPatterns()) return null;

  return (
    <StudioSaveStatusChip
      status={status}
      error={error}
      className={cx('cote-shell-controls__save-status', className)}
    />
  );
}

function ShellReplControls({ context, className }) {
  const { started, pending, isDirty, activeCode, handleTogglePlay, handleEvaluate, handleTogglePianoroll, handleSavePattern } = context;
  const saveState = usePatternSaveState();
  const projectMode = isStudioProjectPatterns();
  const {
    isButtonRowHidden,
    isCSSAnimationDisabled,
    isPanelOpen,
    panelPosition,
    pianorollView,
    replWidgetViz,
    replWidgetSpectrum,
    replWidgetPiano,
  } = useSettings();

  const toggleWidget = (setter, enabled) => {
    const next = !enabled;
    setter(next);
    if (next) {
      setPianorollView(true);
    }
  };

  if (isButtonRowHidden) {
    return null;
  }

  const playTitle = pending ? 'loading' : started ? 'stop' : 'play';
  const updateDisabled = !isDirty || !activeCode;
  const saveDisabled = !projectMode || saveState.status === 'saving';

  return (
    <nav className={cx('cote-shell-controls', className)} aria-label="REPL controls">
      <div className="cote-shell-controls__left">
        <button
          type="button"
          onClick={handleTogglePlay}
          title={playTitle}
          aria-label={playTitle}
          className={cx(
            'cote-shell-controls__btn cote-shell-controls__btn--icon',
            started && 'cote-shell-controls__btn--active',
            !started && !isCSSAnimationDisabled && 'cote-shell-controls__btn--pulse',
          )}
        >
          {started ? (
            <StopIcon className="cote-shell-controls__icon" aria-hidden />
          ) : (
            <PlayIcon className="cote-shell-controls__icon" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={handleEvaluate}
          title="update"
          aria-label="Update pattern"
          disabled={updateDisabled}
          className={cx(
            'cote-shell-controls__btn cote-shell-controls__btn--icon',
            updateDisabled && 'cote-shell-controls__btn--disabled',
          )}
        >
          <ArrowPathIcon className="cote-shell-controls__icon" aria-hidden />
        </button>
        {projectMode ? (
          <button
            type="button"
            onClick={() => void handleSavePattern?.()}
            title="Save pattern (Ctrl+S)"
            aria-label="Save pattern"
            disabled={saveDisabled}
            className={cx(
              'cote-shell-controls__btn cote-shell-controls__btn--icon',
              saveDisabled && 'cote-shell-controls__btn--disabled',
            )}
          >
            <ArrowDownTrayIcon className="cote-shell-controls__icon" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleTogglePianoroll}
          title="Widget panel"
          aria-label="Toggle widget panel"
          aria-pressed={pianorollView}
          className={cx(
            'cote-shell-controls__btn cote-shell-controls__btn--icon',
            pianorollView && 'cote-shell-controls__btn--active',
          )}
        >
          <Squares2X2Icon className="cote-shell-controls__icon" aria-hidden />
        </button>
        <div className="cote-shell-controls__widget-group" role="group" aria-label="Widget cards">
          <button
            type="button"
            onClick={() => toggleWidget(setReplWidgetViz, replWidgetViz)}
            title="Visualizer"
            aria-label="Toggle visualizer widget"
            aria-pressed={replWidgetViz}
            className={cx(
              'cote-shell-controls__btn cote-shell-controls__btn--icon',
              replWidgetViz && 'cote-shell-controls__btn--active',
            )}
          >
            <span className="cote-shell-controls__icon" aria-hidden>
              <RingIcon />
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleWidget(setReplWidgetSpectrum, replWidgetSpectrum)}
            title="Spectrum"
            aria-label="Toggle spectrum widget"
            aria-pressed={replWidgetSpectrum}
            className={cx(
              'cote-shell-controls__btn cote-shell-controls__btn--icon',
              replWidgetSpectrum && 'cote-shell-controls__btn--active',
            )}
          >
            <span className="cote-shell-controls__icon" aria-hidden>
              <GridIcon />
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleWidget(setReplWidgetPiano, replWidgetPiano)}
            title="Piano roll"
            aria-label="Toggle piano roll widget"
            aria-pressed={replWidgetPiano}
            className={cx(
              'cote-shell-controls__btn cote-shell-controls__btn--icon',
              replWidgetPiano && 'cote-shell-controls__btn--active',
            )}
          >
            <span className="cote-shell-controls__icon" aria-hidden>
              <PianoIcon />
            </span>
          </button>
        </div>
      </div>
      <div className="cote-shell-controls__right">
        <PatternSaveStatus />
        <Link
          title="learn"
          to={coteDocsPath('workshop/getting-started')}
          className="cote-shell-controls__btn"
        >
          learn
        </Link>
        <ShellVolumeControl />
        {panelPosition === 'right' && (
          <button
            type="button"
            title="menu"
            aria-label="Toggle side panel"
            aria-expanded={isPanelOpen}
            className={cx('cote-shell-controls__btn cote-shell-controls__menu', isPanelOpen && 'cote-shell-controls__btn--active')}
            onClick={() => setIsPanelOpened(!isPanelOpen)}
          >
            <Bars3Icon className="cote-shell-controls__icon" aria-hidden />
          </button>
        )}
      </div>
    </nav>
  );
}

/** REPL transport controls for the KVI Studio shell header slot. */
export function ReplShellHeader({ context, className }) {
  const { isZen } = useSettings();
  if (isZen) {
    return null;
  }
  return (
    <div className={cx('cote-studio-header-bar cote-studio-header-bar--shell-slot', className)}>
      <ShellReplControls context={context} />
    </div>
  );
}

function PanelCloseButton() {
  const { isPanelOpen } = useSettings();
  const embedded = useCoteEmbedded();
  return (
    isPanelOpen && (
      <button
        onClick={() => setIsPanelOpened(false)}
        className={cx(
          embedded ? 'cote-shell-panel__close' : 'px-2 py-0 text-foreground hover:opacity-50',
        )}
        aria-label="Close Menu"
      >
        <XMarkIcon className={embedded ? 'cote-shell-panel__icon' : 'w-6 h-6'} />
      </button>
    )
  );
}

export function BottomPanel({ context }) {
  const { isPanelOpen, activeFooter: tab } = useSettings();
  const embedded = useCoteEmbedded();
  return (
    <PanelNav
      className={cx(
        embedded && 'cote-shell-panel',
        isPanelOpen ? `min-h-[360px] max-h-[360px]` : 'min-h-10 max-h-10',
        'overflow-hidden flex flex-col relative',
      )}
    >
      <div
        className={cx(
          embedded ? 'cote-shell-panel__header' : 'flex justify-between min-h-10 max-h-10 grid-cols-2 items-center border-t border-muted',
        )}
      >
        <PanelCloseButton />
        <Tabs setTab={setTab} tab={tab} className={cx(!embedded && isPanelOpen && 'border-l border-muted')} />
      </div>
      {isPanelOpen && (
        <div className={cx(embedded ? 'cote-shell-panel__body' : 'w-full h-full overflow-auto border-t border-muted')}>
          <PanelContent context={context} tab={tab} />
        </div>
      )}
    </PanelNav>
  );
}

export function RightPanel({ context }) {
  const settings = useSettings();
  const { activeFooter: tab, isPanelOpen } = settings;
  const embedded = useCoteEmbedded();
  if (!isPanelOpen) {
    return;
  }
  return (
    <PanelNav
      settings={settings}
      className={cx(
        embedded ? 'cote-shell-panel' : 'border-l border-muted shrink-0 h-full overflow-hidden',
        !embedded && (isPanelOpen ? `min-w-[min(600px,100vw)] max-w-[min(600px,80vw)]` : 'min-w-12 max-w-12'),
        embedded && 'shrink-0 h-full overflow-hidden min-w-[min(600px,100vw)] max-w-[min(600px,80vw)]',
      )}
    >
      <div className={cx('flex flex-col h-full', embedded && 'cote-shell-panel__inner')}>
        <div
          className={cx(
            embedded
              ? 'cote-shell-panel__header'
              : 'flex justify-between w-full overflow-hidden border-b border-muted min-h-10 max-h-10',
          )}
        >
          <PanelCloseButton />
          <Tabs setTab={setTab} tab={tab} className={embedded ? undefined : 'border-l border-muted'} />
        </div>
        <div className={embedded ? 'cote-shell-panel__body' : 'overflow-auto h-full'}>
          <PanelContent context={context} tab={tab} />
        </div>
      </div>
    </PanelNav>
  );
}

const tabNames = {
  patterns: 'patterns',
  sounds: 'sounds',
  reference: 'reference',
  export: 'export',
  console: 'console',
  settings: 'settings',
};
if (TAURI) {
  tabNames.files = 'files';
}

function PanelNav({ children, className, ...props }) {
  const settings = useSettings();
  const embedded = useCoteEmbedded();
  return (
    <nav
      onClick={() => {
        if (!settings.isPanelOpen) {
          setIsPanelOpened(true);
        }
      }}
      aria-label="Menu Panel"
      className={cx(
        embedded ? 'cote-shell-panel__nav' : 'h-full bg-lineHighlight group overflow-x-auto',
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

function PanelContent({ context, tab }) {
  useLogger();
  switch (tab) {
    case tabNames.patterns:
      return <PatternsTab context={context} />;
    case tabNames.console:
      return <ConsoleTab />;
    case tabNames.sounds:
      return <SoundsTab />;
    case tabNames.reference:
      return <Reference />;
    case tabNames.export:
      return <ExportTab handleExport={context.handleExport} />;
    case tabNames.settings:
      return <SettingsTab started={context.started} />;
    case tabNames.files:
      return <FilesTab />;
  }
}

function PanelTab({ label, isSelected, onClick }) {
  const embedded = useCoteEmbedded();
  if (embedded) {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={onClick}
        className={cx('cote-shell-tabs__tab', isSelected && 'cote-shell-tabs__tab--active')}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={cx(
        'h-10 px-2 text-sm border-t-2 border-t-transparent text-foreground cursor-pointer hover:opacity-50 flex items-center space-x-1 border-b-2',
        isSelected ? 'border-foreground' : 'border-transparent',
      )}
    >
      {label}
    </button>
  );
}
function Tabs({ className }) {
  const { isPanelOpen, activeFooter: tab } = useSettings();
  const embedded = useCoteEmbedded();
  return (
    <div
      className={cx(
        embedded
          ? 'cote-shell-tabs'
          : 'px-2 w-full flex select-none max-w-full h-10 max-h-10 min-h-10 overflow-auto items-center',
        className,
      )}
      role="tablist"
    >
      {Object.keys(tabNames).map((key) => {
        const val = tabNames[key];
        return <PanelTab key={key} isSelected={tab === val && isPanelOpen} label={key} onClick={() => setTab(val)} />;
      })}
    </div>
  );
}

export function PanelToggle({ isEmbedded, isZen, shellHeader = false }) {
  const { panelPosition, isPanelOpen } = useSettings();
  return (
    (shellHeader || !isEmbedded) &&
    !isZen &&
    panelPosition === 'right' && (
      <button
        title="menu"
        className={cx('border-l border-muted px-2 py-0 text-foreground hover:opacity-50')}
        onClick={() => setIsPanelOpened(!isPanelOpen)}
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    )
  );
}
