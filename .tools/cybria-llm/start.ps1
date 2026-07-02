$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating venv..."
    py -3.12 -m venv .venv
}

$py = ".\.venv\Scripts\python.exe"
& $py -m pip install -q -r requirements.txt

$env:PYTHONUNBUFFERED = "1"
$env:CYBRIA_LLM_DIR = if ($env:CYBRIA_LLM_DIR) { $env:CYBRIA_LLM_DIR } else { "G:\.models\llm" }

Write-Host "Starting cybria-llm on http://127.0.0.1:8790"
& $py server.py
