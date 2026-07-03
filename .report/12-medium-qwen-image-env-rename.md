# Finding #12 — `QWEN_IMAGE_*` env names should be `CYBRIA_DIFFUSER_*`

## Summary

Image/diffusion configuration still uses legacy `QWEN_IMAGE_*` environment variable names across gateway, CLI, and plugin, while `cybria-diffuser` already accepts `CYBRIA_DIFFUSER_*` as preferred aliases.

## Severity

Medium

## Status

**Open** — dual naming in production paths.

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-server/server.py` | `QWEN_IMAGE_PORT`, `QWEN_IMAGE_MAX_SIDE`, etc. |
| `.vault/.../obsidian-cybria-core/src/server-runner.ts` | `GATEWAY_ENV` sets `QWEN_IMAGE_*` |
| `.tools/cybria_cli/services.py` | Image `extra_env` uses `QWEN_IMAGE_*` |
| `.tools/cybria-diffuser/common/app.py` | Reads both prefixes |

## Problem in depth

`cybria-diffuser` was generalized beyond Qwen-only pipelines (SDXL, etc.) but env vars retain Qwen-specific prefix. `common/app.py` falls back correctly:

```78:79:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-diffuser\common\app.py
    host = os.environ.get("CYBRIA_DIFFUSER_HOST", os.environ.get("QWEN_IMAGE_HOST", "127.0.0.1"))
    port = int(os.environ.get("CYBRIA_DIFFUSER_PORT", os.environ.get("QWEN_IMAGE_PORT", "8789")))
```

Gateway and Obsidian still **only** set `QWEN_IMAGE_*`, so new naming is unused in the primary workflow.

## Code evidence

```47:56:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
    "image": {
        ...
        "env_port": "QWEN_IMAGE_PORT",
        "extra_env": {
            "QWEN_IMAGE_MAX_SIDE": os.environ.get("QWEN_IMAGE_MAX_SIDE", "512"),
            ...
        },
    },
```

```360:366:c:\Users\kaitr\.vault\project_cybria\.vault\Project Cybria\.obsidian\plugins\obsidian-cybria-core\src\server-runner.ts
export const GATEWAY_ENV: ServerEnvExtra = () => ({
	CYBRIA_PORT: String(2253),
	QWEN_IMAGE_MAX_SIDE: "512",
	...
});
```

## Impact

- Misleading config for SDXL-only workflows.
- Harder global rename/documentation.

## Recommended fix

1. Set `CYBRIA_DIFFUSER_*` in gateway, CLI, plugin; keep reading `QWEN_IMAGE_*` as deprecated fallback for one release.
2. Document migration in port map — [00-port-map.md](00-port-map.md).

## Effort

**M**

## Related findings

- [11-medium-qwen-image-legacy.md](11-medium-qwen-image-legacy.md)
- [13-medium-max-side-default-mismatch.md](13-medium-max-side-default-mismatch.md)
