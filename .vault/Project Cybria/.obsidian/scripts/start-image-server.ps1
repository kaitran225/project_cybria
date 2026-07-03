$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
& (Join-Path $repoRoot ".tools\qwen-image\start.ps1")
