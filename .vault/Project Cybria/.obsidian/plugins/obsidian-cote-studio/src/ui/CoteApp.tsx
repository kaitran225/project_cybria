import { Notice } from "obsidian";
import { useCallback, useEffect, useState } from "react";
import type { TFile } from "obsidian";
import { DEFAULT_PATTERN } from "../settings";
import { playPattern, stopPattern } from "../strudel-runtime";
import {
  createPattern,
  listPatternFiles,
  readPattern,
  writePattern,
} from "../vault-patterns";
import type CotePlugin from "../main";

function CoteReplLoader({ plugin }: { plugin: CotePlugin }) {
  const [ReplPane, setReplPane] = useState<typeof import("./CoteReplPane").CoteReplPane | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("../repl-chunk")
      .then((mod) => {
        if (!cancelled) setReplPane(() => mod.CoteReplPane);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="cote-status">Failed to load REPL: {error}</div>;
  if (!ReplPane) return <div className="cote-status">Loading Strudel REPL…</div>;
  return <ReplPane plugin={plugin} />;
}

export function CoteApp({ plugin }: { plugin: CotePlugin }) {
  if (plugin.settings.useFullRepl) {
    return (
      <div className="cote-root cote-root--repl">
        <CoteReplLoader plugin={plugin} />
      </div>
    );
  }
  return <CoteSimpleEditor plugin={plugin} />;
}

function CoteSimpleEditor({ plugin }: { plugin: CotePlugin }) {
  const [patterns, setPatterns] = useState<TFile[]>([]);
  const [activeFile, setActiveFile] = useState<TFile | null>(null);
  const [code, setCode] = useState(DEFAULT_PATTERN);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);

  const folder = plugin.settings.patternsFolder;

  const refreshList = useCallback(async () => {
    setPatterns(await listPatternFiles(plugin.app, folder));
  }, [folder, plugin.app]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const openFile = useCallback(
    async (file: TFile) => {
      const text = await readPattern(plugin.app, file);
      setActiveFile(file);
      setCode(text);
      setDirty(false);
      setStatus(`Opened ${file.basename}`);
    },
    [plugin.app]
  );

  const save = useCallback(async () => {
    if (!activeFile) {
      const file = await createPattern(plugin.app, folder, "pattern", code);
      setActiveFile(file);
      setDirty(false);
      await refreshList();
      setStatus(`Created ${file.basename}`);
      return;
    }
    await writePattern(plugin.app, activeFile, code);
    setDirty(false);
    setStatus(`Saved ${activeFile.basename}`);
  }, [activeFile, code, folder, plugin.app, refreshList]);

  const newPattern = useCallback(async () => {
    const file = await createPattern(plugin.app, folder, `pattern-${Date.now().toString(36)}`, DEFAULT_PATTERN);
    await refreshList();
    await openFile(file);
  }, [folder, openFile, plugin.app, refreshList]);

  const onPlay = useCallback(async () => {
    setStatus("Playing…");
    try {
      await playPattern(code);
      setStatus("Playing");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      new Notice(msg);
    }
  }, [code]);

  const onStop = useCallback(async () => {
    await stopPattern();
    setStatus("Stopped");
  }, []);

  return (
    <div className="cote-root">
      <aside className="cote-sidebar">
        <div className="cote-sidebar-head">
          <span>Patterns</span>
          <button type="button" className="cote-btn" onClick={() => void newPattern()}>
            + New
          </button>
        </div>
        <ul className="cote-pattern-list">
          {patterns.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                className={`cote-pattern-item${activeFile?.path === f.path ? " is-active" : ""}`}
                onClick={() => void openFile(f)}
              >
                {f.basename}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="cote-editor-pane">
        <div className="cote-toolbar">
          <button
            type="button"
            className="mod-cta cote-btn"
            onClick={() => void onPlay()}
            title="Play pattern (Ctrl+Enter in full REPL)"
          >
            Play
          </button>
          <button type="button" className="cote-btn" onClick={() => void onStop()}>
            Stop
          </button>
          <button type="button" className="cote-btn" onClick={() => void save()}>
            Save
          </button>
          <span className="cote-status">
            {status}
            {dirty ? " · unsaved" : ""}
          </span>
        </div>
        <textarea
          className="cote-editor"
          value={code}
          spellCheck={false}
          onChange={(e) => {
            setCode(e.target.value);
            setDirty(true);
          }}
        />
      </main>
    </div>
  );
}
