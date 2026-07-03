# Finding #13 — `QWEN_IMAGE_MAX_SIDE` default mismatch

## Summary

Gateway and Obsidian inject `QWEN_IMAGE_MAX_SIDE=512`, while CLI image setup and `cybria-diffuser/check_env.py` default to **1024**. Same codebase produces different max image dimensions depending on launch path.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Default |
|------|---------|
| `.tools/cybria-server/server.py` | `512` |
| `.vault/.../server-runner.ts` `GATEWAY_ENV` | `"512"` |
| `.tools/cybria_cli/services.py` (image specs) | `"1024"` |
| `.tools/cybria-diffuser/check_env.py` | `1024` |

## Problem in depth

Obsidian unified path (primary UX) caps images at 512px max side for VRAM safety. CLI standalone and env check report 1024 as normal. Users switching between Obsidian and `cybria_cli run cybria-diffuser` see different output resolutions without changing settings.

## Code evidence

```52:52:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-server\server.py
            "QWEN_IMAGE_MAX_SIDE": os.environ.get("QWEN_IMAGE_MAX_SIDE", "512"),
```

```31:31:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-diffuser\check_env.py
        "max_side": int(os.environ.get("QWEN_IMAGE_MAX_SIDE", "1024")),
```

```48:48:c:\Users\kaitr\.vault\project_cybria\.tools\cybria_cli\services.py
            "QWEN_IMAGE_MAX_SIDE": "1024",
```

## Impact

- Confusing quality/VRAM behavior across modes.
- Check env reports 1024 while running gateway path at 512.

## Recommended fix

1. Pick one default (512 for 8GB profile, 1024 for desktop) in hardware profile JSON.
2. Inject from `hardware-profiles.json` in both gateway and CLI.
3. Expose max side in Cybria Core image settings.

## Effort

**S**

## Related findings

- [12-medium-qwen-image-env-rename.md](12-medium-qwen-image-env-rename.md)
- [00-port-map.md](00-port-map.md)
