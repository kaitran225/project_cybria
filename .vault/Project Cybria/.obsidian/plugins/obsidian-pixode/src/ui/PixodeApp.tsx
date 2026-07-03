import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PixelAssetDocument } from "@pixode/asset-core";
import {
  PixelCanvas,
  Toolbox,
  type CanvasTool,
  type PixelCanvasHandle,
} from "@pixode/studio-central/canvas/index.js";
import { StudioClient } from "@pixode/studio-central/core/studio.js";
import type { StudioAssetSummary } from "@pixode/studio-central/core/types.js";
import { createVaultFileSystem, ensureFolder } from "../vault-fs";
import type PixodePlugin from "../main";

export function PixodeApp({ plugin }: { plugin: PixodePlugin }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<StudioAssetSummary[]>([]);
  const [assetId, setAssetId] = useState<string | undefined>();
  const [document, setDocument] = useState<PixelAssetDocument | null>(null);
  const [activeLayerId, setActiveLayerId] = useState("base");
  const [activeColorId, setActiveColorId] = useState(1);
  const [activeTool, setActiveTool] = useState<CanvasTool>("pen");
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const canvasRef = useRef<PixelCanvasHandle>(null);
  const saveTimer = useRef(0);

  const studio = useMemo(() => {
    const fs = createVaultFileSystem(plugin.app);
    return new StudioClient({ fs });
  }, [plugin]);

  const projectRoot = plugin.settings.projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");

  const refreshAssets = useCallback(() => {
    setAssets(studio.listAssets("all"));
  }, [studio]);

  const initProject = useCallback(async () => {
    setError(null);
    try {
      await ensureFolder(plugin.app, projectRoot);
      const fs = createVaultFileSystem(plugin.app);
      const manifest = fs.join(projectRoot, "pixode.project.json");
      if (!(await fs.exists(manifest))) {
        await studio.createProject(projectRoot, {
          id: "vault_project",
          name: "Vault Pixode",
        });
      } else {
        await studio.openProject(projectRoot);
      }
      refreshAssets();
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [plugin.app, projectRoot, refreshAssets, studio]);

  useEffect(() => {
    void initProject();
  }, [initProject]);

  const loadAsset = useCallback(
    async (id: string) => {
      const detail = await studio.getAssetDetail(id);
      if (!detail) return;
      setAssetId(id);
      setDocument(detail.document);
      const layer = detail.document.layers[0]?.id ?? "base";
      setActiveLayerId(layer);
      const color = detail.document.palette[1]?.id ?? detail.document.palette[0]?.id ?? 0;
      setActiveColorId(color);
    },
    [studio]
  );

  const scheduleSave = useCallback(
    (doc: PixelAssetDocument) => {
      if (!assetId) return;
      setSaveStatus("Saving…");
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void studio.updateAssetDocument(assetId, doc).then(() => {
          setSaveStatus("Saved");
          window.setTimeout(() => setSaveStatus(""), 1200);
        });
      }, 500);
    },
    [assetId, studio]
  );

  const onDocumentChange = useCallback(
    (doc: PixelAssetDocument) => {
      setDocument(doc);
      scheduleSave(doc);
    },
    [scheduleSave]
  );

  const createAsset = useCallback(async () => {
    const id = `sprite_${Date.now().toString(36)}`;
    await studio.createAsset({ id, category: "enemy", width: 16, height: 16 });
    refreshAssets();
    await loadAsset(id);
  }, [loadAsset, refreshAssets, studio]);

  if (error) {
    return (
      <div className="pixode-root pixode-error">
        <p>{error}</p>
        <button type="button" className="mod-cta" onClick={() => void initProject()}>
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return <div className="pixode-root pixode-loading">Loading Pixode…</div>;
  }

  return (
    <div className="pixode-root">
      <aside className="pixode-sidebar">
        <div className="pixode-sidebar-head">
          <span className="pixode-sidebar-title">Assets</span>
          <button type="button" className="pixode-btn" onClick={() => void createAsset()}>
            + New
          </button>
        </div>
        <ul className="pixode-asset-list">
          {assets.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={`pixode-asset-item${a.id === assetId ? " is-active" : ""}`}
                onClick={() => void loadAsset(a.id)}
              >
                {a.displayName}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="pixode-workspace">
        {document ? (
          <>
            <div className="pixode-toolbar">
              <Toolbox
                variant="toolbar"
                activeTool={activeTool}
                mirrorEnabled={mirrorEnabled}
                onToolChange={setActiveTool}
                onMirrorToggle={setMirrorEnabled}
                onUndo={() => canvasRef.current?.undo()}
                onRedo={() => canvasRef.current?.redo()}
                canUndo={canvasRef.current?.canUndo() ?? false}
                canRedo={canvasRef.current?.canRedo() ?? false}
              />
              <span className="pixode-save-status">{saveStatus}</span>
            </div>
            <div className="pixode-canvas-wrap">
              <PixelCanvas
                ref={canvasRef}
                document={document}
                activeLayerId={activeLayerId}
                activeColorId={activeColorId}
                activeTool={activeTool}
                mirrorEnabled={mirrorEnabled}
                zoom={16}
                showGrid
                showCheckerboard
                onDocumentChange={onDocumentChange}
                onColorPicked={setActiveColorId}
              />
            </div>
            <div className="pixode-palette">
              {document.palette.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pixode-swatch${c.id === activeColorId ? " is-active" : ""}`}
                  style={{ background: c.hex }}
                  title={c.hex}
                  onClick={() => setActiveColorId(c.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="pixode-empty">Select an asset or create a new one.</div>
        )}
      </main>
    </div>
  );
}
