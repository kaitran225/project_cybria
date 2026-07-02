$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    py -3.12 -m venv .venv
}

$py = ".\.venv\Scripts\python.exe"
& $py -m pip install -q -r requirements.txt
Write-Host "Optional: pip install vllm-omni for Higgs TTS inference"
$env:PYTHONUNBUFFERED = "1"
& $py server.py
