# Finding #9 — TTS `requirements.txt` missing vllm / vllm-omni

## Summary

`cybria-tts/requirements.txt` lists FastAPI, httpx, and Hugging Face packages but not `vllm` or `vllm-omni`, which are required at runtime to spawn the inner TTS server.

## Severity

High

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-tts/requirements.txt` | pip install manifest |
| `.tools/cybria-tts/server.py` | `_start_vllm()` expects vllm binary |
| `.vault/.../obsidian-cybria-core/src/server-runner.ts` | `pip install -r requirements.txt` on Install |

## Problem in depth

Obsidian **Install** on the TTS card runs `pip install -r requirements.txt`. That succeeds but does not install vllm. First `POST /models/load` or `/tts` calls `_start_vllm()`, which builds a command from `vllm.exe` in venv Scripts or falls back to `vllm` on PATH.

On `FileNotFoundError`, server sets error message: `vllm not installed. Run: pip install vllm-omni (in cybria-tts venv)`.

Users expect Install to be sufficient; failure appears only at first synthesis.

## Code evidence

```1:7:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-tts\requirements.txt
fastapi>=0.110
uvicorn[standard]>=0.27
httpx>=0.27
huggingface_hub>=0.26
hf_transfer>=0.1.9
pydantic>=2.0
```

```118:127:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-tts\server.py
        _proc = subprocess.Popen(
            cmd,
            ...
        )
    except FileNotFoundError as exc:
        _error = "vllm not installed. Run: pip install vllm-omni (in cybria-tts venv)"
        raise RuntimeError(_error) from exc
```

## Impact

- Broken out-of-box TTS after Install.
- Extra manual step; easy to miss in logs.

## Reproduction

1. Fresh venv: Servers → TTS → Install.
2. Start TTS, load MOSS-TTS-Nano.
3. Observe 500/503 with vllm not installed.

## Recommended fix

1. Add `vllm-omni` (or documented extra requirements file) to `requirements.txt` with platform/CUDA notes.
2. Extend `check_env.py` to verify vllm import and report in JSON.
3. If vllm too heavy for default install, gate in UI with explicit "Install TTS engine" step.

## Effort

**S** (manifest) / **M** (if CUDA-specific install docs needed)

## Related findings

- [10-high-tts-pipe-deadlock.md](10-high-tts-pipe-deadlock.md)
