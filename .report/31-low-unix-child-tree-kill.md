# Finding #31 — Unix child-tree kill weaker than Windows

## Summary

On Windows, `cybria-server` stops service children with `taskkill /F /T` (full process tree). On Unix, it only `terminate()`s the direct child Popen, which may leave llama-server or vllm grandchildren running.

## Severity

Low

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-server/server.py` | `_terminate_process_tree()` |

## Problem in depth

```272:294:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
def _terminate_process_tree(proc: subprocess.Popen[Any]) -> None:
    ...
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                ...
            )
            return
        proc.terminate()
        proc.wait(timeout=8)
```

Linux/macOS: no `killpg`, no recursive child kill. `cybria-llm` spawns llama-server as child of service python — may survive service parent death depending on process group.

Plugin `stopServer` on gateway has same SIGTERM-only pattern — [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md).

## Impact

- Orphan llama/vllm on Linux/macOS after stop.
- Port leaks on dev machines using WSL or Mac.

## Recommended fix

1. Unix: `os.killpg(os.getpgid(pid), signal.SIGTERM)` if process group set at spawn (`start_new_session=True`).
2. Or use `psutil` for recursive children.
3. Align with Windows `/T` semantics.

## Effort

**M**

## Related findings

- [08-high-stop-gateway-no-shutdown-post.md](08-high-stop-gateway-no-shutdown-post.md)
- [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md)
