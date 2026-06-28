$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pip = Join-Path $root ".venv\Scripts\pip.exe"

if (-not (Test-Path $pip)) {
    Write-Error "No .venv found. Run start.ps1 first."
}

Write-Host "Installing flash-attn (optional, may fail on Windows without build tools)..."
& $pip install flash-attn --no-build-isolation
if ($LASTEXITCODE -ne 0) {
    Write-Warning "flash-attn install failed — server will use PyTorch SDPA instead."
    exit 1
}

& "$root\.venv\Scripts\python.exe" -c "import flash_attn; print('flash-attn OK')"
