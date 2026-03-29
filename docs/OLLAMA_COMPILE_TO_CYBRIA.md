# Copy Ollama "Compile Model" Functionality into Cybria

This doc explains how Ollama compiles a custom model from a Modelfile and how to replicate that functionality in the Cybria C# app using the cloned [ollama-main](../ollama-main) as reference.

---

## How Ollama compiles a model

Ollama has two paths; the one that matches "compile from Modelfile" is:

1. **Parse Modelfile** → list of commands (FROM, SYSTEM, PARAMETER, ADAPTER, TEMPLATE, etc.).
2. **Build create request** → turn commands into a structured request (base model, system prompt, parameters, optional adapters).
3. **Create** → either (a) send request to Ollama server (POST /api/create), or (b) for safetensors, write manifest + blobs locally.

### Key files in ollama-main

| Purpose | Path | What to copy / reference |
|--------|------|---------------------------|
| Modelfile grammar and parse | [parser/parser.go](../ollama-main/parser/parser.go) | `Modelfile` struct, `Command`, `ParseFile(io.Reader)`, command names: `from`→model, `template`, `system`, `adapter`, `parameter`, `message`, `license`, `renderer`, `parser`, `requires` |
| Build API request from Modelfile | [parser/parser.go](../ollama-main/parser/parser.go) | `CreateRequest(relativeDir)` → fills `From`, `Files`, `Adapters`, `Template`, `System`, `Parameters`, `Messages`, `License` |
| Config for safetensors create | [x/create/client/create.go](../ollama-main/x/create/client/create.go) | `ModelfileConfig` (Template, System, License, Parser, Renderer, Parameters), `ConfigFromModelfile(modelfile)` → modelDir + config |
| Create CLI flow | [cmd/cmd.go](../ollama-main/cmd/cmd.go) | `getModelfileName`, open file → `parser.ParseFile(reader)` → `modelfile.CreateRequest(dir)` or `ConfigFromModelfile` → then create (API or CreateModel) |
| API create request type | [api/types.go](../ollama-main/api/types.go) | `CreateRequest`: Model, From, Files, Adapters, Template, System, Parameters, Messages, Quantize |

### Command mapping (Modelfile → internal)

- **FROM** → model name or path (stored as `Command{Name: "model", Args: "<value>"}`).
- **SYSTEM** → system prompt.
- **TEMPLATE** → chat template.
- **PARAMETER** name value → parameter key/value (temperature, top_p, top_k, etc.).
- **ADAPTER** → path to adapter (e.g. LoRA).
- **MESSAGE** role: content → few-shot message.
- **LICENSE**, **PARSER**, **RENDERER**, **REQUIRES** → metadata.

---

## Function to add in Cybria: "Compile custom model"

Implement a **compile** step that turns a Modelfile (file or text) into a Cybria "model" (preset config). No need to run Ollama or build GGUF; just parse and save config.

### 1. Modelfile parser (C#)

Port the grammar and parse logic from [parser/parser.go](../ollama-main/parser/parser.go):

- **Types:** `Modelfile` (list of `Command`), `Command` (Name, Args).
- **Parse:** Read line-by-line; support FROM, SYSTEM, TEMPLATE, PARAMETER, ADAPTER, MESSAGE, LICENSE, and quoted/multiline values (see `ParseFile` and state machine in parser.go around 380–450).
- **Output:** `Modelfile` with `Commands` list.

Reuse the same command names and rules so that [.prototype/cybria.Modelfile](../.prototype/cybria.Modelfile) parses correctly.

### 2. Config-from-Modelfile (C#)

Port the logic of [x/create/client/create.go](../ollama-main/x/create/client/create.go) `ConfigFromModelfile`:

- **Input:** Parsed `Modelfile`.
- **Output:**  
  - `ModelDir` or **FROM** value (base model name or path – in Cybria, resolve to GGUF path or keep as name for lookup).  
  - **ModelfileConfig:** Template, System, License, Parser, Renderer, Parameters (map).

Ignore or stub ADAPTER / MESSAGE / REQUIRES for v1 if you only need FROM + SYSTEM + PARAMETER for Cybria.

### 3. "Compile" = save as Cybria model

- **Input:** Modelfile path or content, and **model name** (e.g. `cybria`).
- **Steps:**  
  1. Parse Modelfile (step 1).  
  2. Extract config (step 2).  
  3. Resolve **FROM** to a GGUF path (e.g. from a library dir or user setting; if FROM is a name like `nous-hermes2:latest`, you can map it to a path or prompt user).  
  4. Save Cybria model preset: e.g. `%LocalAppData%/Cybria/models/<modelName>.json` (or `.modelfile`) with `{ "from": "<GGUF path>", "system": "<system>", "parameters": { ... } }`.  
- **Result:** New entry in the model list; user can select it and run. No weight compilation.

### 4. Optional: invoke Ollama create

If the user has Ollama installed and the cloned [ollama-main](../ollama-main) (or official Ollama) running:

- **Option A:** Shell out: `ollama create <name> -f <path-to-modelfile>`. Then the prototype (Flask) can use that model; the C# app would need to talk to Ollama API or only use this for “create and then use elsewhere.”  
- **Option B:** Call Ollama API from C#: build `CreateRequest` from parsed Modelfile (same shape as [api/types.go](../ollama-main/api/types.go) CreateRequest), then POST to `http://localhost:11434/api/create` (see [api/client.go](../ollama-main/api/client.go) Create). That way Cybria can trigger “compile on Ollama” and then list/run the model via Ollama.

Use (4) only if you need actual Ollama-built models; for Cybria’s native GGUF path, (1)–(3) are enough.

---

## Suggested C# layout (in Cybria.Desktop or shared lib)

- **ModelfileParser** – parse stream/file → `Modelfile` (list of Command).  
- **ModelfileConfigBuilder** – Modelfile → `ModelfileConfig` (From, System, Template, Parameters).  
- **CompileCustomModel** – (name, Modelfile path or content) → parse → config → resolve FROM → save preset under `%LocalAppData%/Cybria/models/<name>.json`.  
- **UI:** “Create model” / “Add model from Modelfile” that calls `CompileCustomModel` and refreshes the model list.

This gives you a function that **copies the compile-the-model functionality** from Ollama (parse Modelfile → produce a runnable “model” config) and stores it as a Cybria custom model.
