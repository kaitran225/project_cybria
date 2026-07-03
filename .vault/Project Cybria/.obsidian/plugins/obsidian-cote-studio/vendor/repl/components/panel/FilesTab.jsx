import { Fragment, useEffect } from 'react';
import React, { useMemo, useState } from 'react';
import { isAudioFile, readDir, dir, playFile } from '../../files.mjs';
import { useCoteEmbedded } from '@src/cote-embedded.mjs';
import cx from '@src/cx.mjs';

export function FilesTab() {
  const [path, setPath] = useState([]);
  const embedded = useCoteEmbedded();
  useEffect(() => {
    readDir('', { dir, recursive: true })
      .then((children) => setPath([{ name: '~/music', children }]))
      .catch((err) => {
        console.log('error loadin files', err);
      });
  }, []);
  const current = useMemo(() => path[path.length - 1], [path]);
  const subpath = useMemo(
    () =>
      path
        .slice(1)
        .map((p) => p.name)
        .join('/'),
    [path],
  );
  const folders = useMemo(() => current?.children.filter((e) => !!e.children), [current]);
  const files = useMemo(() => current?.children.filter((e) => !e.children && isAudioFile(e.name)), [current]);
  const select = (e) => setPath((p) => p.concat([e]));

  return (
    <div className={embedded ? 'cote-shell-tab-panel flex flex-col h-full' : 'px-4 flex flex-col h-full'}>
      <div className={embedded ? 'cote-shell-tab-panel__search font-mono text-sm' : 'flex justify-between font-mono pb-1'}>
        <div>
          <span>{`samples('`}</span>
          {path?.map((p, i) => {
            if (i < path.length - 1) {
              return (
                <Fragment key={i}>
                  <button
                    type="button"
                    className={embedded ? 'cote-shell-list__item--inline' : 'cursor-pointer underline'}
                    onClick={() => setPath((p) => p.slice(0, i + 1))}
                  >
                    {p.name}
                  </button>
                  <span>/</span>
                </Fragment>
              );
            }
            return (
              <span className={embedded ? 'text-[var(--accent)]' : 'cursor-pointer underline'} key={i}>
                {p.name}
              </span>
            );
          })}
          <span>{`')`}</span>
        </div>
      </div>
      <div className={embedded ? 'cote-shell-tab-panel__body' : 'overflow-auto'}>
        {!folders?.length && !files?.length && (
          <span className={embedded ? 'cote-shell-list__empty' : 'text-gray-500'}>Nothing here</span>
        )}
        {embedded ? (
          <div className="cote-shell-list">
            {folders?.map((e, i) => (
              <button type="button" className="cote-shell-list__item" key={i} onClick={() => select(e)}>
                <span className="cote-shell-list__title">{e.name}</span>
                <span className="cote-shell-list__meta">folder</span>
              </button>
            ))}
            {files?.map((e, i) => (
              <button
                type="button"
                className="cote-shell-list__item"
                key={i}
                onClick={async () => playFile(`${subpath}/${e.name}`)}
              >
                <span className="cote-shell-list__title">{e.name}</span>
                <span className="cote-shell-list__meta">audio</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {folders?.map((e, i) => (
              <div className="cursor-pointer" key={i} onClick={() => select(e)}>
                {e.name}
              </div>
            ))}
            {files?.map((e, i) => (
              <div
                className="text-gray-500 cursor-pointer select-none"
                key={i}
                onClick={async () => playFile(`${subpath}/${e.name}`)}
              >
                {e.name}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
