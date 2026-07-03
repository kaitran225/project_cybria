$ErrorActionPreference = "Stop"
Write-Host "qwen-image moved to .tools/cybria-diffuser — forwarding…" -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "..\cybria-diffuser\start.ps1")
