$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating venv..."
    py -3.12 -m venv .venv
}

$py = ".\.venv\Scripts\python.exe"
& $py -m pip install -q -r requirements.txt

$env:PYTHONUNBUFFERED = "1"
. (Join-Path (Split-Path $PSScriptRoot -Parent) "Apply-ModelPaths.ps1")

Write-Host "Starting cybria-llm on http://127.0.0.1:8790"
& $py server.py
