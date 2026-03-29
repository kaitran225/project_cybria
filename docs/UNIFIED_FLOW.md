# Unified flow: Modelfile → preset → model → chat

One end-to-end flow that works for both the **prototype** (Ollama) and the **C# app** (GGUF + LLamaSharp).

---

## The flow (single pipeline)

```
┌─────────────┐     compile      ┌─────────────┐     resolve      ┌─────────────────┐     run      ┌───────┐
│ Modelfile   │ ───────────────► │   Preset    │ ───────────────► │ Runnable model  │ ────────────► │ Chat  │
│ (FROM,      │   parse + save   │ (JSON)      │   path or API    │ (GGUF or        │  load +       │       │
│  SYSTEM,    │   config         │ from,       │   lookup         │  Ollama model)  │  apply preset│       │
│  PARAMETER) │                  │ system,    │                  │                 │              │       │
└─────────────┘                  │ params     │                  └─────────────────┘              └───────┘
                                 └─────────────┘
```

1. **Modelfile** – User defines a “model”: base (FROM), system prompt (SYSTEM), and parameters (PARAMETER).
2. **Compile** – Parse Modelfile → extract config → save as **preset** (e.g. `%LocalAppData%/Cybria/models/<name>.json`). No new GGUF is created; the preset just stores where the model is and how to use it.
3. **Resolve** – At runtime, turn the preset’s `from` into something runnable:
   - **Prototype:** `from` is an Ollama model name → use Ollama API (Ollama already has the model/GGUF).
   - **C# app:** `from` is a path to a GGUF file → (optional) validate with GGUF header reader → pass path to LLamaSharp.
4. **Run** – Load the runnable model (via Ollama or LLamaSharp), apply the preset (system prompt, template, parameters), then run chat.

So: **Modelfile → Preset → Resolve model → Load + apply preset → Chat.** Same flow; only “resolve” and “load” differ (Ollama vs GGUF path).

---

## Steps in code

| Step        | What happens | Where (current) |
|------------|--------------|----------------|
| **Author** | User edits Modelfile (FROM, SYSTEM, PARAMETER). | Any editor; e.g. `.prototype/cybria.Modelfile`. |
| **Compile** | `ModelfileParser.Parse()` → `ModelfileConfigBuilder.ConfigFromModelfile()` → `ModelfileCompile.ExportPresetJson()` → save JSON. | `src/Cybria.Modelfile` |
| **Validate (optional)** | If `from` is a file path: `GgufHeaderReader.TryRead(path)` to check it’s a valid GGUF. | `src/Cybria.GGUF` |
| **Resolve** | Prototype: treat `from` as Ollama model name. C# app: treat `from` as GGUF path (or support both). | App-specific (Ollama client vs LLamaSharp). |
| **Load** | Prototype: `ollama run <model>`. C# app: `LLamaWeights.LoadFromFile(path)` (or similar) + create context. | Ollama / LLamaSharp. |
| **Apply preset** | Set system prompt from preset, set default params (temperature, etc.) from preset. | App chat/session logic. |
| **Chat** | User messages + preset system/params → model → replies. | App UI + backend. |

---

## One flow, two backends

- **Same:** Modelfile format, compile step (parse → preset JSON), and the idea of “preset = from + system + params.”
- **Different:** What “from” means and how the model is loaded:
  - **Prototype:** `from` = Ollama model name → resolve = “use that model via Ollama API.”
  - **C# app:** `from` = path to GGUF (or future: Ollama name as well) → resolve = “use that path (and optionally validate with Cybria.GGUF)” → load with LLamaSharp.

If you want a **single unified flow**, keep this pipeline and implement **resolve + load** in each app (Ollama vs GGUF path) so that the rest (Modelfile → preset → apply preset → chat) is the same everywhere.
