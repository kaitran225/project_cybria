# Finding #28 — Catalog models marked `catalog_only`

## Summary

Some entries in `.tools/model-catalog.json` have `"integrated": "catalog_only"`, meaning they appear in documentation/catalog but are not wired into Cybria services or the plugin UI.

## Severity

Low

## Status

**Open** (by design for some models)

## Affected files

| Path | Role |
|------|------|
| `.tools/model-catalog.json` | Model metadata |
| `.vault/.../obsidian-cybria-core/src/catalog.ts` | May filter integrated models |

## Problem in depth

Example — Qwen Image Edit 2511:

```51:64:c:\Users\kaitr\.vault\project_cybria\.tools\model-catalog.json
    {
      "id": "qwen-image-edit-2511",
      ...
      "integrated": "catalog_only",
      "note": "Image-to-image / edit. ... Not wired into plugin yet.",
```

Users browsing catalog JSON may assume pull instructions imply plugin support.

## Impact

- Expectation mismatch for cutting-edge models.
- Manual HF download only.

## Recommended fix

1. Surface `integrated` status in UI when showing catalog-derived lists.
2. Track roadmap in catalog `note` field (already partially done).
3. Implement or move to separate `catalog-experimental.json`.

## Effort

**L** (per model integration) / **S** (documentation)

## Related findings

- [11-medium-qwen-image-legacy.md](11-medium-qwen-image-legacy.md)
