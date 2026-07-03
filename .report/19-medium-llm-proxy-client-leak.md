# Finding #19 — LLM proxy `httpx.AsyncClient` per request

## Summary

`cybria-llm` creates a new `httpx.AsyncClient` for each OpenAI proxy request. The non-streaming code path may not close the client on all branches, risking connection leaks under load.

## Severity

Medium

## Status

**Open**

## Affected files

| Path | Role |
|------|------|
| `.tools/cybria-llm/server.py` | `proxy_openai()` |

## Problem in depth

Streaming path closes client in `gen()` finally block. Non-stream path:

```150:159:c:\Users\kaitr\.vault\project_cybria\.tools\cybria-llm\server.py
        r = await client.request(
            request.method,
            inner,
            headers=headers,
            content=body,
        )
        return JSONResponse(content=r.json(), status_code=r.status_code)
    except httpx.HTTPError as exc:
        await client.aclose()
```

Successful non-stream responses return without `await client.aclose()`. High chat volume could exhaust sockets/file descriptors.

Gateway uses a shared `_client` with lifespan cleanup — better pattern.

## Impact

- Slow leak on long Obsidian sessions with many non-stream completions.
- Mostly affects dev/stress; streaming chat may mask issue.

## Recommended fix

1. Module-level or app-lifespan shared `AsyncClient`.
2. Or `async with httpx.AsyncClient() as client:` per request.
3. Use `try/finally: await client.aclose()` on all paths.

## Effort

**S**

## Related findings

- [00-architecture.md](00-architecture.md) — gateway shared client
