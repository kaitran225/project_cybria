@echo off
title Cybria AI Assistant - Web Server
color 0A

echo.
echo  ==========================================
echo   🧠 Cybria AI Assistant Web Server
echo  ==========================================
echo.

echo Checking Ollama connection...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Warning: Ollama not responding
    echo Make sure Ollama is running: ollama serve
    echo.
) else (
    echo ✅ Ollama is running
)

echo Starting web server...
echo.
echo Server will be available at:
echo   Desktop: http://127.0.0.1:8000
echo   Mobile:  http://127.0.0.1:8000/mobile
echo.
echo Press Ctrl+C to stop the server
echo ==========================================
echo.

python server.py

pause
