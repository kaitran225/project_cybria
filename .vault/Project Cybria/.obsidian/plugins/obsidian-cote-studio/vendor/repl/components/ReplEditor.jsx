import { Code } from '@src/repl/components/Code';
import Loader from '@src/repl/components/Loader';
import { BottomPanel, MainPanel, RightPanel } from '@src/repl/components/panel/Panel';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { refreshPianorollCanvas } from '@src/repl/pianoroll-view.mjs';
import { PianoRollBentoPanel } from '@src/repl/components/pianoroll/PianoRollBentoPanel.jsx';
import { useSettings } from '@src/settings.mjs';
import cx from '@src/cx.mjs';
import { useEffect, useRef } from 'react';

export default function ReplEditor(Props) {
  const { context, shellHeader = false, ...editorProps } = Props;
  const { containerRef, editorRef, error, init, pending, started } = context;
  const settings = useSettings();
  const { panelPosition, isZen, pianorollView: widgetsOpen, replWidgetViz, replWidgetSpectrum, replWidgetPiano } = settings;
  const bentoRef = useRef(null);
  const isEmbedded =
    shellHeader ||
    (typeof window !== 'undefined' && window.location !== window.parent.location);

  useEffect(() => {
    if (!widgetsOpen) {
      return;
    }
    const onResize = () => refreshPianorollCanvas(editorRef.current);
    const frame = requestAnimationFrame(onResize);
    window.addEventListener('resize', onResize);
    const panel = bentoRef.current;
    const observer = panel ? new ResizeObserver(onResize) : null;
    observer?.observe(panel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [widgetsOpen, replWidgetViz, replWidgetSpectrum, replWidgetPiano, editorRef]);

  return (
    <div className="h-full flex flex-col relative cote-repl-editor" {...editorProps}>
      <Loader active={pending} />
      <div className="flex flex-col grow overflow-hidden min-h-0">
        <MainPanel context={context} isEmbedded={isEmbedded} shellHeader={shellHeader} />
        <div className="flex overflow-hidden h-full min-h-0">
          <div
            className={cx(
              'cote-repl-workspace flex min-w-0 min-h-0 flex-1',
              widgetsOpen && 'cote-repl-workspace--split',
            )}
          >
            <div
              className={cx(
                'cote-repl-code cote-repl-bento-code',
                widgetsOpen ? 'cote-repl-code--split' : 'cote-repl-code--full',
              )}
            >
              <article className="bento-card bento-card--surface cote-repl-bento__cell cote-repl-bento__code-cell">
                <div className="cote-repl-bento__body cote-repl-bento__body--code">
                  <Code containerRef={containerRef} editorRef={editorRef} init={init} />
                </div>
              </article>
            </div>
            <PianoRollBentoPanel ref={bentoRef} open={widgetsOpen} active={started} />
          </div>
          {!isZen && panelPosition === 'right' && <RightPanel context={context} />}
        </div>
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <BottomPanel context={context} />}
    </div>
  );
}
