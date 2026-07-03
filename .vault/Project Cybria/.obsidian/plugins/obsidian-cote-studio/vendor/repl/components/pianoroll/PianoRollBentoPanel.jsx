import { PIANOROLL_CANVAS_ID } from '@src/repl/pianoroll-view.mjs';
import { useSettings } from '@src/settings.mjs';
import { forwardRef } from 'react';
import { AudioPixelGrid } from './AudioPixelGrid.jsx';
import { ReplBentoWidget } from './ReplBentoWidget.jsx';
import { WavyRingVisualizer } from './WavyRingVisualizer.jsx';

export const PianoRollBentoPanel = forwardRef(function PianoRollBentoPanel(
  { active = false, open = false },
  ref,
) {
  const { replWidgetViz, replWidgetSpectrum, replWidgetPiano } = useSettings();
  const showTop = replWidgetViz || replWidgetSpectrum;
  const topCount = (replWidgetViz ? 1 : 0) + (replWidgetSpectrum ? 1 : 0);

  return (
    <div
      ref={ref}
      className={`cote-repl-widgets${open ? ' cote-repl-widgets--open' : ''}${!showTop ? ' cote-repl-widgets--no-top' : ''}${!replWidgetPiano ? ' cote-repl-widgets--no-piano' : ''}`}
      aria-hidden={!open}
    >
      {showTop && (
        <div
          className={`cote-repl-widgets__top${topCount === 1 ? ' cote-repl-widgets__top--single' : ''}`}
        >
          {replWidgetViz && (
            <ReplBentoWidget
              className="cote-repl-widget--viz"
              bodyClassName="cote-repl-widget__body--webgl"
            >
              <WavyRingVisualizer active={active} open={open && replWidgetViz} />
            </ReplBentoWidget>
          )}
          {replWidgetSpectrum && (
            <ReplBentoWidget className="cote-repl-widget--spectrum" dotBg>
              <AudioPixelGrid active={active} open={open && replWidgetSpectrum} />
            </ReplBentoWidget>
          )}
        </div>
      )}

      {replWidgetPiano && (
        <div className="cote-repl-widgets__piano">
          <ReplBentoWidget
            className="cote-repl-widget--piano"
            bodyClassName="cote-repl-widget__body--piano"
            dotBg
          >
            <canvas id={PIANOROLL_CANVAS_ID} />
          </ReplBentoWidget>
        </div>
      )}
    </div>
  );
});
