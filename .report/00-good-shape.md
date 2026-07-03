# What's in good shape

Evidence from the codebase for areas called out in the [Overall Audit](Overall%20Audit.md) as working well or recently improved.

## PS1 removal — cross-platform CLI

PowerShell-specific launch scripts are gone. Services are started via Python CLI and a POSIX shell wrapper.

| Artifact | Evidence |
|----------|----------|
| `cybria_cli` | `.tools/cybria_cli/__main__.py`, `services.py`, `runner.py` |
| `run.sh` | `.tools/run.sh` — `exec python3 -m cybria_cli "$@"` |
| Plugin build | `build-plugins.py` — no `.ps1` references in Cybria tooling |

No Cybria-owned `.ps1` files remain under `.tools/` (only unrelated highlighter references in code-suite).

---

## Model paths — portable storage and Python/TS sync

| Feature | Location |
|---------|----------|
| Default `%USERPROFILE%\.models` | `model-paths.ts` → `defaultPortableModelRoot()` |
| Path expansion (`%VAR%`, `~`) | `model-paths.ts` `expandModelPath()`; `model_paths_lib.py` `expand_path()` |
| Unreachable root fallback | `sanitizeModelPaths()` / `_effective_root()` |
| JSON sync for Python | `syncModelPathsFile()` writes `.tools/model-paths.json` on save |
| Hub cache resolution | `hubCacheDir()` — detects `models--*` layout |

```15:22:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\model-paths.ts
export function defaultModelRoot(): string {
	return path.join(os.homedir(), ".models");
}

/** Default stored in settings / model-paths.json (portable across machines). */
export function defaultPortableModelRoot(): string {
	return process.platform === "win32" ? "%USERPROFILE%\\.models" : "~/.models";
}
```

---

## cybria-diffuser — unified Qwen + SDXL, gateway wired

| Feature | Evidence |
|---------|----------|
| Unified server | `.tools/cybria-diffuser/server.py` → `common.app.run("all")` |
| Qwen + SDXL backends | `qwen/pipeline.py`, `sdxl/pipeline.py`, `common/dispatch.py` |
| Gateway route | `cybria-server/server.py` → `"image"` → `cybria-diffuser` on port 22534 |
| Plugin client | `SERVICE_TOOLS.image` = `cybria-diffuser` in `servers.ts` |

Legacy `qwen-image/server.py` exits with redirect message — superseded but folder still present ([11-medium-qwen-image-legacy.md](11-medium-qwen-image-legacy.md)).

---

## LLM launcher — `/v1/models` readiness, stdout streaming, errors

**Fixed in session:** `wait_ready()` probes `/v1/models`, not `/health`.

```139:153:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-llm\server_launcher.py
    def wait_ready(self, timeout: float = READY_TIMEOUT) -> bool:
        """llama_cpp.server exposes /v1/models, not /health."""
        deadline = time.time() + timeout
        url = f"{self.inner_base}/v1/models"
        while time.time() < deadline:
            if self.proc and self.proc.poll() is not None:
                return False
            try:
                r = httpx.get(url, timeout=3.0)
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            time.sleep(1.0)
        return False
```

| Improvement | Evidence |
|-------------|----------|
| 600s default timeout | `READY_TIMEOUT` env default `600` |
| Live subprocess logs | `_start_output_reader()` prints each line |
| Actionable load failures | `_summarize_output()` filters errors; `RuntimeError` with tail |

**Still open:** Gateway `_wait_for_service` only checks HTTP status, not `ready: true` — [02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md). UI poll timeout 300s vs 600s inner — [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md).

---

## Obsidian exit cleanup — shutdown + process tree

| Step | Implementation |
|------|----------------|
| Plugin unload | `main.ts` → `await this.api.shutdownOnExit()` |
| HTTP shutdown | `api.ts` → `POST {baseUrl}/shutdown` |
| Local SIGTERM | `runner().stopServer()` if `isGatewayRunning()` |
| Gateway children | `cybria-server` → `taskkill /F /T` on Windows in `_terminate_process_tree` |

```388:399:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
@app.post("/shutdown")
async def api_shutdown() -> dict[str, Any]:
    """Stop all services and exit the gateway (used when Obsidian closes)."""
    print("[cybria-server] shutdown requested", flush=True)
    stop_all_services()
    ...
```

**Still open:** `/shutdown` called before local-process check — [01-critical-shutdown-on-exit.md](01-critical-shutdown-on-exit.md). Stop button doesn't use `/shutdown` — [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md).

---

## Service cards — compact layout, pulsing load indicator

CSS classes in `servers-panel.ts` and styles:

- `ccore-svc-card`, compact grid `ccore-svc-grid`
- Loading state: `aria-busy`, hidden text pill, pulsing dot (`is-loading` on `ccore-svc-dot`)
- `paintServiceCard()` maps gateway health → visual state

---

## Logging — unfiltered terminal output

| Component | Behavior |
|-----------|----------|
| `server-runner.ts` | `pipeProcess()` — all stdout/stderr lines to callback |
| `cybria-server` | `_drain_service_logs()` — char-by-char, tqdm-aware throttle |
| `terminal-panel.ts` | `api.log.onLine()` renders ANSI via `renderTerminalLine` |
| Gateway launch | No log level filtering in plugin |

---

## Coherent gateway design

Single entry port, on-demand services, shared model paths, and CLI parity remain sound architectural choices — see [00-architecture.md](00-architecture.md).

## Related

- [00-session-validation.md](00-session-validation.md) — manual verification steps
- [README.md](README.md)
