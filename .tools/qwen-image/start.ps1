$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$venv = Join-Path $root ".venv"
$pip = Join-Path $venv "Scripts\pip.exe"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $venv)) {
    py -3.12 -m venv $venv
}

# CUDA PyTorch first (pip default is CPU-only)
& $pip uninstall torch -y 2>$null | Out-Null
& $pip install torch --index-url "https://download.pytorch.org/whl/cu124"
& $pip install -r (Join-Path $root "requirements.txt")

. (Join-Path (Split-Path $root -Parent) "Apply-ModelPaths.ps1")

$env:PYTORCH_CUDA_ALLOC_CONF = "expandable_segments:True"
$env:QWEN_IMAGE_MAX_SIDE = "1024"
$env:QWEN_IMAGE_LIGHTNING_WEIGHT = "Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors"
Write-Host "Starting Qwen image server on http://127.0.0.1:8789 (768px, 8-step Lightning)"
& $python (Join-Path $root "server.py")
