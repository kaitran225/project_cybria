$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$venv = Join-Path $root ".venv"

if (-not (Test-Path $venv)) {
    py -3.12 -m venv $venv
    & "$venv\Scripts\pip.exe" install -r (Join-Path $root "requirements.txt")
}

$env:QWEN_IMAGE_MAX_SIDE = "768"
Write-Host "Starting Qwen image server on http://127.0.0.1:8789"
& "$venv\Scripts\python.exe" (Join-Path $root "server.py")
