import {
  exportPatterns,
  importPatterns,
  loadAndSetFeaturedPatterns,
  loadAndSetPublicPatterns,
  patternFilterName,
  useActivePattern,
  useViewingPatternData,
  userPattern,
} from '../../../user_pattern_utils.mjs';
import { isStudioProjectPatterns } from '../../../project-patterns.mjs';
import { usePatternSaveState } from '../../../pattern-save.mjs';
import { useCoteEmbedded } from '@src/cote-embedded.mjs';
import { useMemo, useRef, useState } from 'react';
import { getMetadata } from '../../../metadata_parser.js';
import { useExamplePatterns } from '../../useExamplePatterns.jsx';
import { parseJSON, isUdels } from '../../util.mjs';
import { useSettings } from '../../../settings.mjs';
import { Pagination } from '../pagination/Pagination.jsx';
import { useDebounce } from '../usedebounce.jsx';
import { Textbox } from './SettingsTab.jsx';
import cx from '@src/cx.mjs';

export function PatternLabel({ pattern } /* : { pattern: Tables<'code'> } */) {
  const meta = useMemo(() => getMetadata(pattern.code), [pattern]);
  const projectMode = isStudioProjectPatterns();
  const embedded = useCoteEmbedded();

  let title = meta.title;
  if (title == null) {
    if (pattern.id) {
      title = pattern.id;
    } else {
      const date = new Date(pattern.created_at);
      title = !isNaN(date) ? date.toLocaleDateString() : 'unnamed';
    }
  }

  if (projectMode || embedded) {
    return <>{title}</>;
  }

  const author = Array.isArray(meta.by) ? meta.by.join(',') : 'Anonymous';
  return <>{`${title} by ${author.slice(0, 100)}`.slice(0, 60)}</>;
}

function PatternListItem({ pattern, isViewing, isPlaying, onClick }) {
  const meta = useMemo(() => getMetadata(pattern.code), [pattern]);
  const projectMode = isStudioProjectPatterns();
  const embedded = useCoteEmbedded();
  const shellUi = embedded;
  const subtitle = projectMode
    ? pattern.file ?? `patterns/${pattern.id}.strudel`
    : Array.isArray(meta.by)
      ? meta.by.join(', ')
      : 'Anonymous';

  return (
    <button
      type="button"
      className={cx(
        shellUi ? 'cote-shell-list__item' : 'mr-4 hover:opacity-50 cursor-pointer block text-left w-full',
        isViewing && (shellUi ? 'cote-shell-list__item--active' : 'ring-selection'),
        isPlaying && !shellUi && 'outline outline-1',
        isPlaying && shellUi && 'cote-shell-list__item--playing',
      )}
      onClick={onClick}
    >
      <span className={shellUi ? 'cote-shell-list__title' : undefined}>
        <PatternLabel pattern={pattern} />
      </span>
      {shellUi ? <span className="cote-shell-list__meta">{subtitle}</span> : null}
    </button>
  );
}

function PatternList({ patterns, activePattern, onClick, started, viewingPatternID }) {
  const embedded = useCoteEmbedded();
  const items = Object.values(patterns).reverse();

  if (embedded) {
    return (
      <div className="cote-shell-list">
        {items.length === 0 ? (
          <p className="cote-shell-list__empty">No patterns yet. Create one to get started.</p>
        ) : (
          items.map((pattern) => (
            <PatternListItem
              key={pattern.id}
              pattern={pattern}
              isViewing={pattern.id === viewingPatternID}
              isPlaying={pattern.id === activePattern && started}
              onClick={() => onClick(pattern.id)}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="p-2">
      {items.map((pattern) => (
        <PatternListItem
          key={pattern.id}
          pattern={pattern}
          isViewing={pattern.id === viewingPatternID}
          isPlaying={pattern.id === activePattern && started}
          onClick={() => onClick(pattern.id)}
        />
      ))}
    </div>
  );
}

const updateCodeWindow = (context, patternData, reset = false) => {
  context.handleUpdate(patternData, reset);
};

function ShellToolbarButton({ label, onClick, variant = 'secondary', disabled }) {
  return (
    <button
      type="button"
      className={cx('studio-btn studio-btn--compact', variant === 'danger' ? 'danger' : 'secondary')}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function StrudelToolbarButton({ label, onClick }) {
  return (
    <button type="button" className="hover:opacity-50 text-xs text-nowrap w-fit" onClick={onClick}>
      {label}
    </button>
  );
}

export function PatternsTab({ context }) {
  const [search, setSearch] = useState('');
  const activePattern = useActivePattern();
  const viewingPatternData = useViewingPatternData();
  const embedded = useCoteEmbedded();
  const projectMode = isStudioProjectPatterns();
  const saveState = usePatternSaveState();

  const { userPatterns } = useSettings();
  const viewingPatternID = viewingPatternData?.id;

  const visiblePatterns = useMemo(() => {
    if (!search) {
      return userPatterns;
    }
    return Object.fromEntries(
      Object.entries(userPatterns).filter(([_key, pattern]) => {
        const meta = getMetadata(pattern.code);
        const searchLowercaseTrimmed = search.trim().toLowerCase();
        if (searchLowercaseTrimmed.includes(':')) {
          const [metaKey, metaSearch] = searchLowercaseTrimmed.split(/:\s*/);
          if (metaKey !== undefined && metaSearch !== undefined && metaKey in meta) {
            const metaValues = meta[metaKey];
            if (Array.isArray(metaValues)) {
              return metaValues.some((metaValue) => metaValue.toLowerCase().includes(metaSearch));
            }
            if (typeof metaValues === 'string') {
              return metaValues.toLowerCase().includes(metaSearch);
            }
            return false;
          }
        }
        const title = meta.title ? meta.title : pattern.id ?? 'unnamed';
        const authors = meta.by ? meta.by : ['anonymous'];
        const tags = meta.tag ? meta.tag : [];
        const file = pattern.file ?? '';
        return (
          title.toLowerCase().includes(searchLowercaseTrimmed) ||
          pattern.id?.toLowerCase().includes(searchLowercaseTrimmed) ||
          file.toLowerCase().includes(searchLowercaseTrimmed) ||
          authors.some((author) => author.toLowerCase().includes(searchLowercaseTrimmed)) ||
          tags.some((tag) => tag.toLowerCase().includes(searchLowercaseTrimmed))
        );
      }),
    );
  }, [search, userPatterns]);

  const importRef = useRef();
  const ToolbarBtn = embedded ? ShellToolbarButton : StrudelToolbarButton;

  const openPattern = (id) => {
    updateCodeWindow(context, { ...userPatterns[id], collection: userPattern.collection });
  };

  return (
    <div
      className={cx(
        'w-full h-full flex flex-col overflow-hidden',
        embedded ? 'cote-patterns-panel cote-shell-tab-panel' : 'text-foreground',
      )}
    >
      <div className={embedded ? 'cote-patterns-panel__search' : 'w-full'}>
        {embedded ? (
          <Textbox
            placeholder="Search patterns…"
            value={search}
            onChange={setSearch}
          />
        ) : (
          <input
            type="search"
            className="w-full border-0 bg-transparent px-2 py-2"
            placeholder="Search patterns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      <div
        className={cx(
          embedded
            ? 'cote-patterns-panel__toolbar'
            : 'px-2 shrink-0 h-8 space-x-4 flex max-w-full overflow-x-auto border-y border-muted',
        )}
      >
        <ToolbarBtn
          label="New"
          onClick={() => {
            const created = userPattern.createAndAddToDB();
            if (created?.data) updateCodeWindow(context, created.data);
          }}
        />
        <ToolbarBtn
          label="Duplicate"
          onClick={() => {
            const { data } = userPattern.duplicate(viewingPatternData);
            updateCodeWindow(context, data);
          }}
        />
        <ToolbarBtn
          label="Delete"
          onClick={() => {
            const { data } = userPattern.delete(viewingPatternID);
            updateCodeWindow(context, { ...data, collection: userPattern.collection });
          }}
        />
        <input
          ref={importRef}
          style={{ display: 'none' }}
          type="file"
          multiple
          accept="text/plain,text/x-markdown,application/json,.strudel"
          onChange={(e) => importPatterns(e.target.files)}
        />
        <ToolbarBtn label="Import" onClick={() => importRef.current?.click()} />
        <ToolbarBtn label="Export" onClick={exportPatterns} />
        {projectMode ? (
          <ToolbarBtn
            label={saveState.status === 'saving' ? 'Saving…' : 'Save now'}
            disabled={saveState.status === 'saving'}
            onClick={() => void context.handleSavePattern?.()}
          />
        ) : null}
        <ToolbarBtn
          label="Delete all"
          variant="danger"
          onClick={() => {
            const { data } = userPattern.clearAll();
            if (data) updateCodeWindow(context, data);
          }}
        />
      </div>

      {projectMode ? (
        <p className="cote-patterns-panel__hint">
          Patterns autosave to <code>.strudel</code> files after you edit. Press <kbd>Ctrl+S</kbd> or Save now to write immediately.
        </p>
      ) : null}

      <div className={embedded ? 'cote-patterns-panel__list' : 'overflow-auto'}>
        <PatternList
          onClick={openPattern}
          patterns={visiblePatterns}
          started={context.started}
          activePattern={activePattern}
          viewingPatternID={viewingPatternID}
        />
      </div>
    </div>
  );
}

function PatternPageWithPagination({ patterns, patternOnClick, context, paginationOnChange, initialPage }) {
  const [page, setPage] = useState(initialPage);
  const debouncedPageChange = useDebounce(() => {
    paginationOnChange(page);
  });

  const onPageChange = (pageNum) => {
    setPage(pageNum);
    debouncedPageChange();
  };

  const activePattern = useActivePattern();
  return (
    <div className="flex flex-grow flex-col  h-full overflow-hidden justify-between">
      <div className="overflow-auto flex flex-col flex-grow bg-background p-2 rounded-md ">
        <PatternList
          onClick={(id) => patternOnClick(id)}
          started={context.started}
          patterns={patterns}
          activePattern={activePattern}
          viewingPatternID={null}
        />
      </div>
      <div className="flex items-center gap-2 py-2">
        <label htmlFor="pattern pagination">Page</label>
        <Pagination id="pattern pagination" currPage={page} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

let featuredPageNum = 1;
function FeaturedPatterns({ context }) {
  const examplePatterns = useExamplePatterns();
  const collections = examplePatterns.collections;
  const patterns = collections.get(patternFilterName.featured);
  return (
    <PatternPageWithPagination
      patterns={patterns}
      context={context}
      initialPage={featuredPageNum}
      patternOnClick={(id) => {
        updateCodeWindow(context, { ...patterns[id], collection: patternFilterName.featured });
      }}
      paginationOnChange={async (pageNum) => {
        await loadAndSetFeaturedPatterns(pageNum - 1);
        featuredPageNum = pageNum;
      }}
    />
  );
}

let latestPageNum = 1;
function LatestPatterns({ context }) {
  const examplePatterns = useExamplePatterns();
  const collections = examplePatterns.collections;
  const patterns = collections.get(patternFilterName.public);
  return (
    <PatternPageWithPagination
      patterns={patterns}
      context={context}
      initialPage={latestPageNum}
      patternOnClick={(id) => {
        updateCodeWindow(context, { ...patterns[id], collection: patternFilterName.public });
      }}
      paginationOnChange={async (pageNum) => {
        await loadAndSetPublicPatterns(pageNum - 1);
        latestPageNum = pageNum;
      }}
    />
  );
}

function PublicPatterns({ context }) {
  const { patternFilter } = useSettings();
  if (patternFilter === patternFilterName.featured) {
    return <FeaturedPatterns context={context} />;
  }
  return <LatestPatterns context={context} />;
}
