# Port and environment variable reference

Defaults as implemented in source (July 2026). Override via environment unless noted.

## Port map

| Port | Process | Mode | Config variable(s) |
|------|---------|------|-------------------|
| **2253** | cybria-server (gateway) | Unified | `CYBRIA_PORT` |
| **22531** | cybria-llm (gateway-internal) | Unified | `CYBRIA_LLM_INTERNAL_PORT`, child env `CYBRIA_LLM_PORT` |
| **22532** | cybria-summarize | Unified | `CYBRIA_SUMMARIZE_INTERNAL_PORT`, `CYBRIA_SUMMARIZE_PORT` |
| **22533** | cybria-tts | Unified | `CYBRIA_TTS_INTERNAL_PORT`, `CYBRIA_TTS_PORT` |
| **22534** | cybria-diffuser | Unified | `CYBRIA_IMAGE_INTERNAL_PORT`, child `QWEN_IMAGE_PORT` |
| **8789** | cybria-diffuser | Standalone | `CYBRIA_DIFFUSER_PORT`, `QWEN_IMAGE_PORT` |
| **8790** | cybria-llm | Standalone | `CYBRIA_LLM_PORT` |
| **8791** | cybria-summarize | Standalone | `CYBRIA_SUMMARIZE_PORT` |
| **8792** | cybria-tts | Standalone | `CYBRIA_TTS_PORT` |
| **18790** | llama-server / llama_cpp.server | Inner (LLM) | `CYBRIA_LLM_INNER_PORT`, `CYBRIA_LLM_INNER_HOST` |
| **18792** | vllm-omni | Inner (TTS) | `CYBRIA_TTS_INNER_PORT` |

### URL paths (gateway)

| Path | Backend service |
|------|-----------------|
| `http://127.0.0.1:2253/health` | Gateway aggregate health |
| `http://127.0.0.1:2253/shutdown` | Gateway shutdown (POST) |
| `http://127.0.0.1:2253/services/{name}/start` | Spawn service (POST) |
| `http://127.0.0.1:2253/llm/*` | cybria-llm |
| `http://127.0.0.1:2253/summarize/*` | cybria-summarize |
| `http://127.0.0.1:2253/tts/*` | cybria-tts |
| `http://127.0.0.1:2253/image/*` | cybria-diffuser |

Obsidian `baseUrl` setting defaults to `http://127.0.0.1:2253` (`servers.ts`).

## Gateway environment

| Variable | Default | Set by | Purpose |
|----------|---------|--------|---------|
| `CYBRIA_HOST` | `127.0.0.1` | cybria-server | Bind address |
| `CYBRIA_PORT` | `2253` | gateway, CLI, `GATEWAY_ENV` | Public gateway port |
| `CYBRIA_LLM_INTERNAL_PORT` | `22531` | cybria-server | LLM child listen port |
| `CYBRIA_SUMMARIZE_INTERNAL_PORT` | `22532` | cybria-server | Summarize child port |
| `CYBRIA_TTS_INTERNAL_PORT` | `22533` | cybria-server | TTS child port |
| `CYBRIA_IMAGE_INTERNAL_PORT` | `22534` | cybria-server | Diffuser child port |
| `QWEN_IMAGE_MAX_SIDE` | `512` | gateway `extra_env` | Image max side (gateway only) |
| `QWEN_IMAGE_LIGHTNING` | `1` | gateway | Lightning LoRA toggle |
| `QWEN_IMAGE_COMPILE` | `0` | gateway | torch.compile |
| `QWEN_IMAGE_WARMUP` | `0` | gateway | Skip warmup on start |

## LLM environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CYBRIA_LLM_HOST` | `127.0.0.1` | Service bind |
| `CYBRIA_LLM_PORT` | `8790` (standalone) / `22531` (via gateway) | Service port |
| `CYBRIA_LLM_INNER_HOST` | `127.0.0.1` | llama-server bind |
| `CYBRIA_LLM_INNER_PORT` | `18790` | llama-server port |
| `CYBRIA_LLM_N_GPU_LAYERS` | `99` | GPU offload layers |
| `CYBRIA_LLM_CTX` | `8192` | Context size |
| `CYBRIA_LLM_READY_TIMEOUT` | `600` | Seconds to wait for `/v1/models` |

## Summarize environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CYBRIA_SUMMARIZE_HOST` | `127.0.0.1` | Bind |
| `CYBRIA_SUMMARIZE_PORT` | `8791` / `22532` | Service port |

## TTS environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CYBRIA_TTS_HOST` | `127.0.0.1` | Bind |
| `CYBRIA_TTS_PORT` | `8792` / `22533` | Service port |
| `CYBRIA_TTS_INNER_PORT` | `18792` | vllm-omni port |
| `CYBRIA_TTS_MODEL_ID` | catalog default | Active model |
| `CYBRIA_TTS_GPU_MEMORY_UTILIZATION` | `0.3` | vLLM GPU fraction |

## Diffuser environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CYBRIA_DIFFUSER_HOST` | `127.0.0.1` | Bind (falls back `QWEN_IMAGE_HOST`) |
| `CYBRIA_DIFFUSER_PORT` | `8789` / `22534` | Service port (falls back `QWEN_IMAGE_PORT`) |
| `CYBRIA_DIFFUSER_WARMUP` | `0` | Warmup on start (falls back `QWEN_IMAGE_WARMUP`) |
| `QWEN_IMAGE_MAX_SIDE` | `1024` (CLI/check_env) / `512` (gateway) | Max image dimension |
| `QWEN_IMAGE_MODEL` | unsloth Qwen 4bit | Default model id |
| `QWEN_IMAGE_LIGHTNING_WEIGHT` | safetensors filename | Lightning adapter |
| `PYTORCH_CUDA_ALLOC_CONF` | `expandable_segments:True` | CLI image setup |

## Model path environment

Set by `model_paths_lib.model_path_env()` and TypeScript `modelPathEnv()`:

| Variable | Source key |
|----------|------------|
| `CYBRIA_MODEL_ROOT` | `root` |
| `CYBRIA_LLM_DIR` | `llm` |
| `CYBRIA_SUMMARIZE_DIR` | `summarization` |
| `CYBRIA_TTS_DIR` | `tts` |
| `QWEN_LORA_DIR` | `loras` |
| `HF_HOME` | `root` |
| `HUGGINGFACE_HUB_CACHE` | hub under `huggingface` |
| `TRANSFORMERS_CACHE` | same hub |
| `DIFFUSERS_CACHE` | same hub |

Per-service overrides: `CYBRIA_LLM_DIR`, etc. when set in process env take precedence over JSON file (`model_paths_lib.get_path`).

## Runtime / subprocess

| Variable | Purpose |
|----------|---------|
| `PYTHONUNBUFFERED` | `1` — live logs |
| `PYTHONIOENCODING` | `utf-8` |
| `PYTHONUTF8` | `1` |
| `FORCE_COLOR` | `1` |
| `HF_XET_HIGH_PERFORMANCE` | `1` — faster HF downloads |

## Collision notes

- **18790**: gateway-managed LLM and standalone `cybria-llm` both default here — [05-high-inner-port-collision.md](05-high-inner-port-collision.md)
- **18792**: TTS inner vllm only (no LLM conflict)
- **22531–22534**: `_free_port()` may kill non-Cybria listeners — [04-high-free-port-kills-any-listener.md](04-high-free-port-kills-any-listener.md)

## Related

- [00-architecture.md](00-architecture.md)
- [13-medium-max-side-default-mismatch.md](13-medium-max-side-default-mismatch.md)
