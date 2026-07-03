$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
& (Join-Path $repoRoot ".tools\cybria-diffuser\start.ps1")
