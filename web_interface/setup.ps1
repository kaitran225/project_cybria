# Cybria AI Assistant - PowerShell Setup Script
# Advanced setup with error handling and system checks

param(
    [switch]$SkipOllama,
    [switch]$Force,
    [int]$Port = 8000
)

Write-Host "🧠 Cybria AI Assistant Web Interface Setup" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# Check PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "❌ PowerShell 5.0 or higher required" -ForegroundColor Red
    exit 1
}

# Check Python installation
Write-Host "`n[1/5] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "❌ Python not found! Install from https://python.org" -ForegroundColor Red
    exit 1
}

# Check pip and install dependencies
Write-Host "`n[2/5] Installing Python dependencies..." -ForegroundColor Yellow
try {
    pip install -r requirements.txt --quiet
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Write-Host "Try running: pip install Flask Flask-CORS requests" -ForegroundColor Yellow
    exit 1
}

# Check Ollama (unless skipped)
if (-not $SkipOllama) {
    Write-Host "`n[3/5] Checking Ollama status..." -ForegroundColor Yellow
    try {
        $ollamaResponse = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
        Write-Host "✅ Ollama is running" -ForegroundColor Green
        
        # Check for nous-hermes2 model
        $hasHermes = $ollamaResponse.models | Where-Object { $_.name -match "nous-hermes2" }
        if ($hasHermes) {
            Write-Host "✅ nous-hermes2 model found" -ForegroundColor Green
        } else {
            Write-Host "⚠️  nous-hermes2 model not found" -ForegroundColor Yellow
            Write-Host "Run: ollama pull nous-hermes2:7b" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "⚠️  Ollama not responding" -ForegroundColor Yellow
        Write-Host "Ensure Ollama is installed and running:" -ForegroundColor Gray
        Write-Host "1. Download from https://ollama.com" -ForegroundColor Gray
        Write-Host "2. Run: ollama serve" -ForegroundColor Gray
        Write-Host "3. Run: ollama pull nous-hermes2:7b" -ForegroundColor Gray
        
        if (-not $Force) {
            $continue = Read-Host "Continue without Ollama? (y/N)"
            if ($continue -ne "y" -and $continue -ne "Y") {
                exit 1
            }
        }
    }
}

# Create Cybria model
Write-Host "`n[4/5] Setting up Cybria model..." -ForegroundColor Yellow
try {
    $modelOutput = ollama create cybria -f cybria.Modelfile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cybria model created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Model creation returned warnings" -ForegroundColor Yellow
        Write-Host $modelOutput -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed to create Cybria model" -ForegroundColor Red
    Write-Host "You can create it manually: ollama create cybria -f cybria.Modelfile" -ForegroundColor Yellow
}

# Create data directory
Write-Host "`n[5/5] Finalizing setup..." -ForegroundColor Yellow
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
}
Write-Host "✅ Data directory ready" -ForegroundColor Green

# Get network information
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress

# Display completion message
Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host "`nTo start the server:" -ForegroundColor Cyan
Write-Host "  python server.py" -ForegroundColor White
Write-Host "`nAccess URLs:" -ForegroundColor Cyan
Write-Host "  Local Desktop: http://127.0.0.1:$Port" -ForegroundColor White
Write-Host "  Local Mobile:  http://127.0.0.1:$Port/mobile" -ForegroundColor White
if ($localIP) {
    Write-Host "  Network:       http://$localIP:$Port" -ForegroundColor White
}

Write-Host "`nQuick start commands:" -ForegroundColor Cyan
Write-Host "  .\start_server.bat    # Start with batch file" -ForegroundColor White
Write-Host "  python server.py      # Start directly" -ForegroundColor White

Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
Write-Host "  Status check: http://127.0.0.1:$Port/api/status" -ForegroundColor Gray
Write-Host "  Test Ollama:  ollama run cybria" -ForegroundColor Gray
Write-Host "  View logs in console output" -ForegroundColor Gray

Write-Host "`n💡 Pro tip: Use 'python server.py' to see detailed logs" -ForegroundColor Blue
Write-Host "=" * 50 -ForegroundColor Gray
