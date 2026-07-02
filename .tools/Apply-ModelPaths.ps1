# Apply global model paths from .tools/model-paths.json (sourced by start scripts).
$ErrorActionPreference = "Stop"
$ToolsRoot = $PSScriptRoot
$ConfigPath = Join-Path $ToolsRoot "model-paths.json"

$ModelRoot = "G:\.models"
$LoraDir = "G:\.models\LoRa"
$HuggingFaceHome = "G:\.models\Qwen"
$LlmDir = "G:\.models\llm"
$TtsDir = "G:\.models\tts"
$SummarizationDir = "G:\.models\summarization"

if (Test-Path $ConfigPath) {
    $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    if ($cfg.root) { $ModelRoot = [string]$cfg.root }
    if ($cfg.loras) { $LoraDir = [string]$cfg.loras }
    if ($cfg.huggingface) { $HuggingFaceHome = [string]$cfg.huggingface }
    if ($cfg.llm) { $LlmDir = [string]$cfg.llm }
    if ($cfg.tts) { $TtsDir = [string]$cfg.tts }
    if ($cfg.summarization) { $SummarizationDir = [string]$cfg.summarization }
}

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
