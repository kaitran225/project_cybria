@echo off
REM Setup script for Cybria AI Assistant on Windows

echo Installing frontend dependencies...
cd ..\frontend
call npm install

echo Installing backend dependencies...
cd ..\backend
pip install -r requirements.txt

echo Pulling Ollama model (nous-hermes2:7b)...
ollama pull nous-hermes2:7b

echo Creating Cybria model...
ollama create cybria -f ..\ai-models\modelfiles\cybria.Modelfile

echo Setup complete! You can now run start.bat to launch the application.
