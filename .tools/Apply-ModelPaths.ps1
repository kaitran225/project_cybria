# Apply global model paths from .tools/model-paths.json (synced from Cybria Core settings).
$ErrorActionPreference = "Stop"
$ToolsRoot = $PSScriptRoot
$ConfigPath = Join-Path $ToolsRoot "model-paths.json"

if (-not (Test-Path $ConfigPath)) {
    Write-Warning "Model paths not configured. Set model storage in Cybria Core settings (or create $ConfigPath)."
    return
}

$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json

function Expand-ModelPath([string]$Value) {
    if (-not $Value) { return "" }
    $expanded = [Environment]::ExpandEnvironmentVariables($Value.Trim())
    if ($expanded.StartsWith("~/")) {
        return Join-Path $HOME $expanded.Substring(2)
    }
    return $expanded
}

$ModelRoot = Expand-ModelPath ([string]$cfg.root)
if (-not $ModelRoot.Trim()) {
    Write-Warning "Model root is empty in $ConfigPath. Set model storage in Cybria Core settings."
    return
}

$LoraDir = if ($cfg.loras) { Expand-ModelPath ([string]$cfg.loras) } else { Join-Path $ModelRoot "LoRa" }
$HuggingFaceHome = if ($cfg.huggingface) { Expand-ModelPath ([string]$cfg.huggingface) } else { Join-Path $ModelRoot "Qwen" }
$LlmDir = if ($cfg.llm) { Expand-ModelPath ([string]$cfg.llm) } else { Join-Path $ModelRoot "llm" }
$TtsDir = if ($cfg.tts) { Expand-ModelPath ([string]$cfg.tts) } else { Join-Path $ModelRoot "tts" }
$SummarizationDir = if ($cfg.summarization) { Expand-ModelPath ([string]$cfg.summarization) } else { Join-Path $ModelRoot "summarization" }

$HubDir = $HuggingFaceHome
if (-not (Get-ChildItem $HuggingFaceHome -Filter "models--*" -ErrorAction SilentlyContinue)) {
    $HubDir = Join-Path $HuggingFaceHome "hub"
}

foreach ($dir in @($ModelRoot, $LoraDir, $HuggingFaceHome, $HubDir, $LlmDir, $TtsDir, $SummarizationDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

$env:CYBRIA_MODEL_ROOT = $ModelRoot
$env:QWEN_LORA_DIR = $LoraDir
$env:HF_HOME = $ModelRoot
$env:HUGGINGFACE_HUB_CACHE = $HubDir
$env:TRANSFORMERS_CACHE = $HubDir
$env:DIFFUSERS_CACHE = $HubDir
$env:CYBRIA_LLM_DIR = $LlmDir
$env:CYBRIA_TTS_DIR = $TtsDir
$env:CYBRIA_SUMMARIZE_DIR = $SummarizationDir
