# Finding #5 — Inner ports 18790 / 18792 shared across modes

## Summary

`cybria-llm` always binds inner llama-server to port **18790** and `cybria-tts` binds vllm to **18792** by default, regardless of whether the service runs standalone or behind the gateway. Two instances (gateway-managed + CLI standalone) collide on the same inner port.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-llm/server_launcher.py` | `INNER_PORT` default 18790 |
| `.tools/cybria-tts/server.py` | `INNER_PORT` default 18792 |
| `.tools/cybria-server/server.py` | Spawns services without unique inner port env |

## Problem in depth

Gateway assigns unique **outer** internal ports (22531–22534) per service child, but does not set `CYBRIA_LLM_INNER_PORT` or `CYBRIA_TTS_INNER_PORT` in `extra_env`. Each child inherits defaults:

- LLM → llama on 127.0.0.1:**18790**
- TTS → vllm on 127.0.0.1:**18792**

Standalone CLI runs use the same defaults on the same host. Starting gateway LLM while standalone LLM is loaded (or vice versa) causes bind failure or attaches to the wrong process.

Port 18792 is TTS-only; 18790 is the primary collision risk for LLM.

## Code evidence

```19:20:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-llm\server_launcher.py
INNER_HOST = os.environ.get("CYBRIA_LLM_INNER_HOST", "127.0.0.1")
INNER_PORT = int(os.environ.get("CYBRIA_LLM_INNER_PORT", "18790"))
```

```27:27:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-tts\server.py
INNER_PORT = int(os.environ.get("CYBRIA_TTS_INNER_PORT", "18792"))
```

Gateway `SERVICES` `extra_env` for `llm` and `tts` is `{}` — no inner port offset per instance.

## Impact

- Opaque llama startup failures ("address already in use").
- Wrong-model routing if second service talks to first service's llama.
- Blocks running CLI debug alongside Obsidian unified mode.

## Reproduction

1. `python -m cybria_cli run cybria-llm` — loads model on 18790.
2. Launch gateway from Obsidian, Start LLM.
3. Second llama fails or reuses first process.

## Recommended fix

1. Gateway sets unique inner ports per child, e.g. `CYBRIA_LLM_INNER_PORT=28790` for gateway instance.
2. Or detect port in use and auto-increment with logged choice.
3. Document standalone vs gateway cannot run same service class concurrently without env override.
4. `_free_port` should **not** be applied to 18790 without Cybria PID check — [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md).

## Effort

**M**

## Related findings

- [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md)
- [00-port-map.md](00-port-map.md)
