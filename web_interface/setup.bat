@echo off
title Cybria AI Assistant - Web Interface Setup
color 0A

echo.
echo  ==========================================
echo   🧠 Cybria AI Assistant Web Interface
echo  ==========================================
echo.

echo [1/4] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Please install Python 3.7+ from https://python.org
    pause
    exit /b 1
) else (
    python --version
    echo ✅ Python found
)

echo.
echo [2/4] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
) else (
    echo ✅ Dependencies installed
)

echo.
echo [3/4] Checking Ollama status...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Ollama not running or not found
    echo.
    echo Please ensure:
    echo 1. Ollama is installed from https://ollama.com
    echo 2. Ollama service is running
    echo 3. Run: ollama pull nous-hermes2:7b
    echo.
    set /p continue="Continue anyway? (y/n): "
    if /i not "%continue%"=="y" exit /b 1
) else (
    echo ✅ Ollama is running
)

echo.
echo [4/4] Creating Cybria model...
ollama create cybria -f cybria.Modelfile
if errorlevel 1 (
    echo ⚠️  Model creation may have failed
    echo You can create it manually later with: ollama create cybria -f cybria.Modelfile
) else (
    echo ✅ Cybria model created
)

echo.
echo ==========================================
echo  🎉 Setup Complete!
echo ==========================================
echo.
echo To start the server, run:
echo   start_server.bat
echo.
echo Or manually:
echo   python server.py
echo.
echo Access URLs:
echo   Desktop: http://127.0.0.1:8000
echo   Mobile:  http://127.0.0.1:8000/mobile
echo.
pause
