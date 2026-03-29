# C++ / Go to C# Conversion (Native Sharp)

This doc describes what has been converted to C#, what still relies on native/C++ code, and how to continue toward a “native sharp” stack (more logic in C#, less in C++/Go).

---

## What’s already in C#

### 1. Modelfile (Go → C#)

- **Location:** `src/Cybria.Modelfile/`
- **Source:** Ollama Go `parser/parser.go` and `x/create/client/create.go`
- **Ported:**
  - **Modelfile** parser: rune-based state machine, `Parse(TextReader)` / `Parse(string)`
  - **ModelfileConfig**: template, system, license, parser, renderer, parameters
  - **ConfigFromModelfile**: extract config from a parsed Modelfile; minimal parameter typing (temperature, top_p, etc.)
  - **ModelfileCompile**: `Compile(reader)` and `ExportPresetJson()` for the “compile custom model” flow (save preset, no Go)
- **Tests:** `src/Cybria.Modelfile.Tests/` (parse `.prototype/cybria.Modelfile`, assert model/system/parameters)

So: **Modelfile parsing and “compile to preset” are already pure C#.** No Ollama or Go needed for that.

### 2. GGUF header reader (Go → C#)

- **Location:** `src/Cybria.GGUF/`
- **Source:** Ollama Go `fs/gguf/gguf.go` (header: magic, version, counts)
- **Ported:** Minimal GGUF header read: magic `GGUF`, version (≥2), and optional metadata (e.g. n_key_values) so the app can validate/inspect GGUF files in pure C# without loading the native backend.
- **Use case:** “Is this a valid GGUF?” and basic metadata before handing the file to LLamaSharp’s native loader.

---

## What still uses C++ (llama.cpp)

- **LLamaSharp** (under `LLamaSharp/`) loads models and runs inference by calling **native llama.cpp** (DLL/so/dylib) via P/Invoke (`NativeApi`, `SafeLlamaModelHandle`, etc.).
- Model weights, tensor math, and sampling are all in C++. There is no pure C# inference engine in this repo.

So: **inference today = C# front-end + C++ (llama.cpp) backend.**

---

## What “convert C++ to native sharp” means

- **“Native sharp”** here = more behavior implemented in **C#** instead of C++.
- **Full “llama.cpp → pure C#”** would mean reimplementing in C#:
  - GGUF loading (tensors, metadata)
  - Inference loop (forward pass, sampling)
  - Optional: quantization, GPU kernels
- That’s a large project. The practical approach is **incremental**:

| Phase | What | Status |
|-------|------|--------|
| 1 | Modelfile + config in C# | Done (`Cybria.Modelfile`) |
| 2 | GGUF header / metadata in C# | Done (`Cybria.GGUF` minimal reader) |
| 3 | (Future) GGUF metadata + key-values in C# | Not started |
| 4 | (Future) Pure C# inference (e.g. small model, CPU) | Not started; would be a separate effort |

Continuing “convert cpp to native sharp” can mean:
- Extending the C# GGUF reader (e.g. read key-values, tensor count) so more logic runs in C# before calling native load.
- Later, experimenting with a minimal pure C# inference path (e.g. for tiny models or tooling) while still using LLamaSharp + llama.cpp for production.

---

## Where to put new C# conversion code

- **Modelfile / presets:** `src/Cybria.Modelfile/` (done).
- **GGUF reading / inspection:** `src/Cybria.GGUF/` (minimal reader added).
- **Future pure C# inference (if any):** New project, e.g. `src/Cybria.Inference/` or under `LLamaSharp` as an alternative backend; keep LLamaSharp’s native backend as default.

---

## References

- **Modelfile plan:** `go_to_c#_modelfile_conversion_678cd35e.plan.md` (parser + ConfigFromModelfile).
- **Ollama GGUF (Go):** `ollama-main/fs/gguf/` (`gguf.go`, `reader.go`, `keyvalue.go`, `lazy.go`).
- **LLamaSharp native:** `LLamaSharp/LLama/Native/` (P/Invoke to llama.cpp).
