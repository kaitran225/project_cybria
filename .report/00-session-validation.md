# Session validation checklist

Manual end-to-end tests for changes implemented in the July 2026 session but not yet fully validated on hardware. Run on the target machine (Windows + GPU assumed for LLM/image).

## Prerequisites

- [ ] Obsidian vault open: `Project Cybria`
- [ ] Cybria Core plugin enabled
- [ ] Model storage set to `%USERPROFILE%\.models` (or confirm portable default in settings)
- [ ] Gateway deps installed (Servers tab → Install deps on gateway card)
- [ ] Per-service venvs installed for services you will test

---

## 1. Model paths (`%USERPROFILE%\.models`)

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Open Cybria Core settings → Model storage | Root shows `%USERPROFILE%\.models` or expanded equivalent |
| 1.2 | Confirm `.tools/model-paths.json` exists | `root` matches portable form |
| 1.3 | Download or place a small LLM GGUF under `{root}/llm/` | Path recognized by `cybria-llm` |
| 1.4 | Start LLM service | Logs show correct model dir, not old `G:\.models` |

**Pass criteria:** All services resolve models under the configured home directory.

**Related:** [17-medium-sanitize-paths-ui-drift.md](17-medium-sanitize-paths-ui-drift.md)

---

## 2. LLM load (Qwen 3B, slow first GPU load)

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Servers tab → LLM → select Qwen 3B (or installed 3B model) | Model selected |
| 2.2 | Click **Start** | Gateway starts LLM child; terminal shows llama-server output |
| 2.3 | Wait up to **10 minutes** on first GPU load | Model reaches ready; no false “failed” at 120s gateway wait |
| 2.4 | Apps → Chat → send a short prompt | Response streams or returns |
| 2.5 | Check terminal for `/v1/models` readiness messages | No spurious “health” 404 on inner server |

**Pass criteria:** First load completes; chat works. Note any timeout failures for [03-high-llm-load-timeouts.md](03-high-llm-load-timeouts.md).

**Session fix verified:** Inner readiness uses `/v1/models` in `server_launcher.py` (not `/health`).

---

## 3. Obsidian exit → all processes stop

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Launch gateway + at least LLM (loaded) | Processes running |
| 3.2 | Note PIDs: gateway, cybria-llm, llama-server | Task Manager / `netstat` |
| 3.3 | Close Obsidian (or disable Cybria Core) | `onunload` runs |
| 3.4 | Verify ports 2253, 22531, 18790 free | No stale listeners |
| 3.5 | **Repeat with external gateway URL** (another machine or shared instance) | Remote gateway must **not** shut down — see finding #1 |

**Pass criteria (local gateway):** All Cybria processes terminated.

**Caution:** [01-critical-shutdown-on-exit.md](01-critical-shutdown-on-exit.md) — remote gateway test may fail until fixed.

---

## 4. Compact server cards + terminal logging

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Servers tab → observe service cards | Compact layout; status dot pulses when loading |
| 4.2 | Start a service with tqdm/download progress | Terminal shows live `\r` progress (~1/sec throttle) |
| 4.3 | Click **Clear** on terminal | Log clears |
| 4.4 | Trigger an error (e.g. missing model) | Full error text in terminal, not filtered |

**Pass criteria:** UI matches compact design; logs unfiltered in terminal panel.

---

## 5. Gateway vs switcher consistency

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | With gateway running, open Home dashboard | Slot status reflects services |
| 5.2 | Click **Refresh status** on Servers tab | Cards and switcher align |
| 5.3 | Stop one service | Card shows idle/stopped; switcher updates |

**Known gaps:** No auto-refresh during long load — [30-low-no-periodic-refresh.md](30-low-no-periodic-refresh.md); external gateway — [06-high-external-gateway-switcher-offline.md](06-high-external-gateway-switcher-offline.md).

---

## 6. Image / TTS (optional smoke)

| Service | Minimal test |
|---------|----------------|
| Image | Start → generate 512px image from Image app |
| TTS | Start → synthesize short phrase from Audio app |
| Summarize | Start → summarize paragraph from Novel app |

---

## Sign-off

| Area | Tester | Date | Pass / Fail | Notes |
|------|--------|------|-------------|-------|
| Model paths | | | | |
| LLM Qwen 3B load | | | | |
| Exit cleanup (local) | | | | |
| Exit cleanup (remote URL) | | | | |
| Server cards + logs | | | | |
| Gateway/switcher | | | | |

## Related

- [Overall Audit — Session changes](Overall%20Audit.md#session-changes-not-yet-validated-end-to-end)
- [README.md](README.md)
