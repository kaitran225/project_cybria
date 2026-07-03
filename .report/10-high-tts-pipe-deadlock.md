# Finding #10 — TTS vllm stdout pipe deadlock risk

## Summary

`cybria-tts` starts the vllm subprocess with `stdout=subprocess.PIPE` but does not drain stdout in a background thread during the startup wait loop. Verbose vllm output can fill the pipe buffer and block the child process.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-tts/server.py` | `_start_vllm()` |

## Problem in depth

Contrast with `cybria-llm/server_launcher.py` which runs `_start_output_reader()` on a daemon thread, and `cybria-server` which uses `_drain_service_logs()`.

TTS `_start_vllm`:

```119:124:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-tts\server.py
        _proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
```

The polling loop only reads stdout **after** process exit (`_proc.stdout.read(4000)` on line 132). While vllm is running and printing logs, nothing consumes the pipe. On Windows/Linux, typical pipe capacity is 64KB–几MB; exceeding it stalls vllm's write side → health poll never succeeds → 5 min timeout.

## Code evidence

```129:145:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-tts\server.py
    deadline = time.time() + 300
    while time.time() < deadline:
        if _proc.poll() is not None:
            out = _proc.stdout.read(4000) if _proc.stdout else ""
            _error = f"vllm exited: {out[:800]}"
            raise RuntimeError(_error)
        try:
            r = httpx.get(f"{_inner_base()}/health", timeout=2.0)
            ...
        time.sleep(1.0)
```

## Impact

- Intermittent TTS startup hangs until timeout.
- Hard to diagnose without knowing pipe deadlock pattern.

## Reproduction

1. Install vllm-omni with verbose logging.
2. Load TTS model via gateway.
3. If vllm prints heavily before `/health` 200, observe hang near pipe fill.

## Recommended fix

1. Mirror LLM pattern: daemon thread reading lines to `print(..., flush=True)`.
2. Or use `stdout=None` / `stderr=None` to inherit terminal when not capturing.
3. Gateway already drains service-level stdout; inner vllm pipe is separate and still needs drain.

## Effort

**S**

## Related findings

- [09-high-tts-requirements-missing-vllm.md](09-high-tts-requirements-missing-vllm.md)
- [00-good-shape.md](00-good-shape.md) — logging improvements elsewhere
