# Finding #4 — `_free_port()` kills any listener on service ports

## Summary

Before starting a gateway-managed service, `start_service()` calls `_free_port()` which force-kills **any** process listening on ports 22531–22534, not only stale Cybria children from a prior run.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-server/server.py` | `_free_port()`, `start_service()` |

## Problem in depth

When the gateway starts e.g. LLM on internal port 22531, it first checks if the port is in use. If so, it runs `taskkill /F` (Windows) or `kill -9` (Unix) on every PID bound to that port from `netstat` / `lsof`.

There is no check that the PID belongs to a Cybria service (venv python, known cwd, or parent gateway). A developer running standalone `cybria-llm` on 22531, or any unrelated app on that port, gets killed silently.

## Code evidence

```189:220:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
def _free_port(port: int) -> None:
    """Kill whatever process is bound to a local port (stale service from a prior run)."""
    if not _port_in_use(port):
        return
    print(f"[cybria-server] port {port} busy — clearing stale listener", flush=True)
    ...
            for pid in pids:
                subprocess.run(["taskkill", "/F", "/PID", pid], ...)
```

```238:238:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
    _free_port(cfg["internal_port"])
```

## Impact

- Data loss if another application's server is on 22531–22534.
- Surprising kills during parallel dev (CLI standalone + Obsidian gateway).
- Security-sensitive on shared machines (denial of service on those ports).

## Reproduction

1. Run `python server.py` in `cybria-llm` with `CYBRIA_LLM_PORT=22531`.
2. From Obsidian, Start LLM via gateway.
3. Observe gateway log "port 22531 busy — clearing stale listener" and standalone process terminated.

## Recommended fix

1. Prefer checking `_procs` registry and parent PID before killing.
2. If port busy, verify process cmdline contains `cybria-llm` / expected venv path.
3. If unknown PID, return error from `start_service` instead of kill.
4. Optional: use SO_REUSEADDR / ephemeral coordination file with gateway PID.

## Effort

**M**

## Related findings

- [05-high-inner-port-collision.md](05-high-inner-port-collision.md)
- [00-port-map.md](00-port-map.md)
