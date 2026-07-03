# Project Cybria — Audit Reports

Detailed findings from the [Overall Audit](Overall%20Audit.md) (July 2026), expanded with code evidence from `.tools/`, `obsidian-cybria-core`, and vault configuration.

## Supplementary

| Report | Description |
|--------|-------------|
| [00-architecture.md](00-architecture.md) | Component responsibilities, data flow, entry points |
| [00-good-shape.md](00-good-shape.md) | Areas working well, with code evidence |
| [00-port-map.md](00-port-map.md) | Ports and environment variable reference |
| [00-session-validation.md](00-session-validation.md) | Manual test checklist for recent session changes |

## Critical

| # | Report | Summary |
|---|--------|---------|
| 1 | [01-critical-shutdown-on-exit.md](01-critical-shutdown-on-exit.md) | `shutdownOnExit` may POST `/shutdown` to a remote/shared gateway |

## High

| # | Report | Summary |
|---|--------|---------|
| 2 | [02-high-gateway-start-not-model-ready.md](02-high-gateway-start-not-model-ready.md) | Gateway start OK ≠ model ready; weak `/health` wait |
| 3 | [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md) | LLM first load can exceed UI/gateway timeouts |
| 4 | [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md) | `_free_port()` kills any process on service ports |
| 5 | [05-high-inner-port-collision.md](05-high-inner-port-collision.md) | Inner ports 18790/18792 shared across modes |
| 6 | [06-high-external-gateway-switcher-offline.md](06-high-external-gateway-switcher-offline.md) | Model switcher skips health when no local proc |
| 7 | [07-high-launch-server-silent-venv-miss.md](07-high-launch-server-silent-venv-miss.md) | Missing venv → silent return, 30s timeout |
| 8 | [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md) | Stop gateway uses SIGTERM only, not `/shutdown` |
| 9 | [09-high-tts-requirements-missing-vllm.md](09-high-tts-requirements-missing-vllm.md) | TTS `requirements.txt` omits vllm / vllm-omni |
| 10 | [10-high-tts-pipe-deadlock.md](10-high-tts-pipe-deadlock.md) | TTS vllm stdout never drained → pipe deadlock |

## Medium

| # | Report | Summary |
|---|--------|---------|
| 11 | [11-medium-qwen-image-legacy.md](11-medium-qwen-image-legacy.md) | Legacy `qwen-image/` folder still present |
| 12 | [12-medium-qwen-image-env-rename.md](12-medium-qwen-image-env-rename.md) | `QWEN_IMAGE_*` should become `CYBRIA_DIFFUSER_*` |
| 13 | [13-medium-max-side-default-mismatch.md](13-medium-max-side-default-mismatch.md) | `QWEN_IMAGE_MAX_SIDE` 512 vs 1024 |
| 14 | [14-medium-duplicate-model-paths.md](14-medium-duplicate-model-paths.md) | Five duplicate `model_paths.py` wrappers |
| 15 | [15-medium-switcher-onchange-leak.md](15-medium-switcher-onchange-leak.md) | `onChange` listener never unsubscribed |
| 16 | [16-medium-model-paths-no-restart-warning.md](16-medium-model-paths-no-restart-warning.md) | Path changes need gateway restart, no warning |
| 17 | [17-medium-sanitize-paths-ui-drift.md](17-medium-sanitize-paths-ui-drift.md) | Sanitized paths vs settings UI display |
| 18 | [18-medium-migration-not-persisted.md](18-medium-migration-not-persisted.md) | Satellite migration flag not saved on first load |
| 19 | [19-medium-llm-proxy-client-leak.md](19-medium-llm-proxy-client-leak.md) | New `httpx.AsyncClient` per request |
| 20 | [20-medium-summarize-health-always-ready.md](20-medium-summarize-health-always-ready.md) | Summarize `/health` always `ready: true` |
| 21 | [21-medium-gateway-launch-race.md](21-medium-gateway-launch-race.md) | No mutex on gateway launch/stop |
| 22 | [22-medium-start-service-partial-failure.md](22-medium-start-service-partial-failure.md) | Service proc may stay up after model load fails |

## Low

| # | Report | Summary |
|---|--------|---------|
| 23 | [23-low-no-readme.md](23-low-no-readme.md) | No project README |
| 24 | [24-low-reason-plugin-missing.md](24-low-reason-plugin-missing.md) | `reason` enabled but folder missing |
| 25 | [25-low-web-view-incomplete.md](25-low-web-view-incomplete.md) | `web-view` enabled without `main.js` |
| 26 | [26-low-style-settings-ts-sdk.md](26-low-style-settings-ts-sdk.md) | Style Settings installed but not enabled |
| 27 | [27-low-dual-obsidian-trees.md](27-low-dual-obsidian-trees.md) | Repo root vs vault `.obsidian/` |
| 28 | [28-low-catalog-only-models.md](28-low-catalog-only-models.md) | Catalog models marked `integrated: catalog_only` |
| 29 | [29-low-cli-tts-id-typo.md](29-low-cli-tts-id-typo.md) | CLI TTS ServiceSpec `id` typo |
| 30 | [30-low-no-periodic-refresh.md](30-low-no-periodic-refresh.md) | No auto-refresh during long loads |
| 31 | [31-low-unix-child-tree-kill.md](31-low-unix-child-tree-kill.md) | Unix child-tree kill weaker than Windows |

## Recommended fix order

See [Overall Audit — Recommended fix order](Overall%20Audit.md#recommended-fix-order).
