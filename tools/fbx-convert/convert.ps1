param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$InputFbx,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$OutputGlb
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PyScript = Join-Path $ScriptDir "fbx_to_glb.py"

if (-not (Test-Path $InputFbx)) {
    Write-Error "Input not found: $InputFbx"
}

$blender = Get-Command blender -ErrorAction SilentlyContinue
if (-not $blender) {
    Write-Error @"
Blender not found on PATH.

Install Blender from https://www.blender.org/download/
Or load the .fbx directly in tools/avatar-viewer (no conversion needed).
"@
}

$outDir = Split-Path -Parent $OutputGlb
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Write-Host "Converting $InputFbx -> $OutputGlb"
& blender --background --python $PyScript -- $InputFbx $OutputGlb

if ($LASTEXITCODE -ne 0) {
    Write-Error "Blender export failed (exit $LASTEXITCODE)"
}

Write-Host "Done: $OutputGlb"
