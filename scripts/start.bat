@echo off
REM Start script for Cybria AI Assistant on Windows

echo Starting Cybria AI Assistant...

REM Start Ollama (if not already running)
echo Starting Ollama...
start /B ollama serve

REM Wait for Ollama to start
timeout /t 5

REM Start backend server
echo Starting backend server...
cd ..\backend
start /B uvicorn main:app --host 0.0.0.0 --port 8000 --reload

REM Wait for backend to start
timeout /t 3

REM Start frontend
echo Starting frontend...
cd ..\frontend
start /B npm start

echo Cybria AI Assistant is running!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo Ollama API: http://localhost:11434
