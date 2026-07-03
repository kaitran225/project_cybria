$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pip = Join-Path $root ".venv\Scripts\pip.exe"
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $pip)) {
    Write-Error "No .venv found. Run start.ps1 first or: py -3.12 -m venv .venv"
}

$index = "https://download.pytorch.org/whl/cu124"
Write-Host "Removing CPU-only torch if present..."
& $pip uninstall torch -y 2>$null | Out-Null
Write-Host "Installing PyTorch (CUDA 12.4)..."
& $pip install torch --index-url $index
& $python -c "import torch; print('torch', torch.__version__); print('cuda', torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no gpu')"
