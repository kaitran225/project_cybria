# Cybria App – Overview

This document explains what the Cybria app is, how it is structured, and whether it can create custom models like Ollama.

---

## What is the Cybria app?

**Cybria** is an AI chat assistant built around a single character (Cybria) with multiple **identities** you can switch between. The character has a fixed backstory and personality (tactical, hacker-assassin from the KVI organization); each identity (Cybria, Riley, Nina, Sophie, Luna, Victoria) changes how that character responds (e.g. “Riley” as a web developer, “Victoria” as a security consultant).

The project includes:

1. **Prototype (current)** – A web app in [`.prototype`](.prototype): Flask server + HTML (desktop and mobile). It talks to **Ollama** over HTTP; you run `ollama run cybria` and use the Cybria “model” that was created from a Modelfile.
2. **Planned C# native app** – A local-only Windows desktop app (WPF) that uses **LLamaSharp** (and optionally a pure C# inference path) to load a **GGUF model** and run chat entirely on your machine. No Ollama, no web server.

So: same character and identity system; two ways to run it (Ollama-based prototype vs. future C# native app).

---

## App variants (short)

| | Prototype | Planned C# app |
|---|-----------|----------------|
| **Location** | [`.prototype`](.prototype) | `src/Cybria.Desktop` (planned) |
| **Stack** | Python, Flask, HTML/JS | C#, WPF, LLamaSharp |
| **LLM** | Ollama (e.g. `cybria` model) | GGUF file loaded by LLamaSharp |
| **Run** | `python server.py` → browser | Single .exe, no server |
| **Identities** | Same (Cybria, Riley, Nina, Sophie, Luna, Victoria) | Same (system prompts in-app) |

---

## Can this app compile a custom model like Ollama?

**It depends which part of the app you mean.**

### Prototype (Ollama-based)

- **Yes, indirectly.** The prototype does not “compile” the model itself; **Ollama** does. You use a **Modelfile** (e.g. [`.prototype/cybria.Modelfile`](.prototype/cybria.Modelfile)) to define:
  - **FROM** – base model (e.g. `nous-hermes2:latest`)
  - **SYSTEM** – system prompt (Cybria’s identity, backstory, rules)
  - **PARAMETER** – temperature, top_p, etc.
  - Optionally **ADAPTER** – LoRA
- Then you run: `ollama create cybria -f cybria.Modelfile`. Ollama creates a named “model” (cybria) that bakes in that system prompt and settings. The Cybria web app then talks to `ollama run cybria`. So **custom model creation is done by Ollama**, not by the app; the app just uses whatever model you run in Ollama.

### Planned C# native app (LLamaSharp + GGUF)

- **Ollama-like feature (planned).** The C# app will support a feature **similar to Ollama**: Modelfile-style config, named models, and model list/selection. You add named models via a Modelfile (FROM = GGUF path, SYSTEM = system prompt, PARAMETER = defaults); the app stores configs (e.g. under `%LocalAppData%/Cybria/models/`) and lets you switch between models like Ollama. No weight compilation – each "model" is a config pointing to a GGUF.

- **Ollama-like feature (planned).** The C# app will support a feature **similar to Ollama**: Modelfile-style config, named models, and model list/selection. It will **load and run** a **GGUF** file (e.g. a Cybria GGUF you built or downloaded). You add named models via a Modelfile (FROM = GGUF path, SYSTEM = system prompt, PARAMETER = defaults); the app stores configs and lets you switch between models like Ollama. (No weight compilation.) “create custom model” - So **out of the box it will not “compile” a custom model** 
**Ways to get “custom model” behavior with the C# app:**

1. **Identities in-app (already planned)**  
   The app will have the same identity system (Cybria, Riley, Nina, etc.). Each identity is a **system prompt** applied at runtime. That gives you different “modes” of the same loaded GGUF, similar in spirit to having different “models” (personas), but it does not create a new model file.

2. **Build the GGUF outside the app**  
   You can create a “custom” model elsewhere and then use it in the app:
   - Use **Ollama** (Modelfile + `ollama create`) and then export/create a GGUF if your workflow supports it, or
   - Use **llama.cpp** (or other tools) to convert, merge LoRA, quantize, and produce a GGUF, then point the C# app at that GGUF.

3. **Future: “presets” or “custom model” in the app**  
   A possible extension would be to add something like:
   - **Presets:** Save name + system prompt + inference params (no new GGUF). The app would behave like “custom models” for chat, without compiling weights.
   - **Modelfile-like support:** A format (e.g. Modelfile or similar) that the app reads and uses to set system prompt and params for a given GGUF – again, no new GGUF, but similar UX to Ollama’s custom model idea.

**Summary:** The **prototype** uses **Ollama** to create and run custom models via Modelfile. The **C# app** will provide an **Ollama-like feature** (planned): Modelfile support, named models/presets, and model list/selection by storing and applying configs (FROM + SYSTEM + PARAMETER); it does not compile new GGUF files.

---

## Where to read more

- **Unified flow:** [docs/UNIFIED_FLOW.md](docs/UNIFIED_FLOW.md) – single pipeline: Modelfile → preset → resolve model → load + apply → chat (same flow for prototype and C# app).
- **Prototype:** [`.prototype/README.md`](.prototype/README.md) – setup, run, features.
- **Cybria character / Modelfile:** [`.prototype/cybria.Modelfile`](.prototype/cybria.Modelfile) – system prompt and identity text.
- **C# native plan:** See the plan for the local-only WPF app (LLamaSharp, optional pure C# runtime).
- **llama.cpp → C# plan:** See [docs/CPP_TO_CS_CONVERSION.md](docs/CPP_TO_CS_CONVERSION.md).
