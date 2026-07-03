# Launch unified Cybria AI server on port 2253
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$py = Join-Path $here ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { py -3.12 -m venv .venv }
& $py -m pip install -q -r requirements.txt
. (Join-Path (Split-Path $here -Parent) "Apply-ModelPaths.ps1")
$env:CYBRIA_PORT = "2253"
& $py server.py
