import cx from '@src/cx.mjs';
import { useSettings } from '../../../settings.mjs';
import { useStore } from '@nanostores/react';
import { $strudel_log_history } from '../useLogger';
import { useEffect, useRef } from 'react';
import { useCoteEmbedded } from '@src/cote-embedded.mjs';

const LOG_TAG_RE = /^\[([^\]]+)\]\s*/;

function parseLogTag(message) {
  const match = message.match(LOG_TAG_RE);
  if (!match) {
    return { tag: null, body: message };
  }
  return { tag: match[1].toLowerCase(), body: message.slice(match[0].length) };
}

function consoleLineClass(embedded, type, tag) {
  if (!embedded) {
    return cx(
      'whitespace-nowrap',
      type === 'error' ? 'text-background bg-foreground' : 'text-foreground',
      type === 'highlight' && 'underline',
    );
  }
  return cx(
    'cote-shell-console__line',
    type === 'error' && 'cote-shell-console__line--error',
    type === 'highlight' && 'cote-shell-console__line--highlight',
    type === 'highlight' && 'cote-shell-console__line--tag-warn',
    tag === 'eval' && 'cote-shell-console__line--tag-eval',
    tag === 'sampler' && 'cote-shell-console__line--tag-sampler',
    tag === 'cyclist' && 'cote-shell-console__line--tag-cyclist',
    tag === 'gettrigger' && 'cote-shell-console__line--tag-warn',
  );
}

export function ConsoleTab() {
  const log = useStore($strudel_log_history);
  const embedded = useCoteEmbedded();
  const { fontFamily } = useSettings();
  const scrollRef = useRef();
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);
  return (
    <div
      id="console-tab"
      className={cx('break-all w-full h-full', embedded && 'cote-shell-console')}
      style={embedded ? undefined : { fontFamily }}
    >
      <div className="h-full w-full overflow-auto space-y-1 p-2 rounded-md" ref={scrollRef}>
        {log.map((l) => {
          const { tag, body } = parseLogTag(l.message);
          const message = linkify(body);
          const color = l.data?.hap?.value?.color;
          return (
            <div
              key={l.id}
              className={consoleLineClass(embedded, l.type, tag)}
              style={color ? { color } : {}}
            >
              {embedded && tag ? (
                <>
                  <span className="cote-shell-console__tag">[{l.message.match(LOG_TAG_RE)?.[1]}]</span>
                  <span dangerouslySetInnerHTML={{ __html: message }} />
                </>
              ) : (
                <span
                  dangerouslySetInnerHTML={{ __html: embedded ? message : linkify(l.message) }}
                  className={embedded ? undefined : 'whitespace-nowrap'}
                />
              )}
              {l.count ? ` (${l.count})` : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function linkify(inputText) {
  var replacedText, replacePattern1, replacePattern2, replacePattern3;

  replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
  replacedText = inputText.replace(replacePattern1, '<a class="underline" href="$1" target="_blank">$1</a>');

  replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
  replacedText = replacedText.replace(
    replacePattern2,
    '$1<a class="underline" href="http://$2" target="_blank">$2</a>',
  );

  replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
  replacedText = replacedText.replace(replacePattern3, '<a class="underline" href="mailto:$1">$1</a>');

  return replacedText;
}
