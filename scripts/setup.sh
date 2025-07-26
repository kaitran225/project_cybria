#!/bin/bash
# Setup script for Cybria AI Assistant

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd ../backend
pip install -r requirements.txt

# Pull Ollama model
echo "Pulling Ollama model (nous-hermes2:7b)..."
ollama pull nous-hermes2:7b

# Create Cybria model
echo "Creating Cybria model..."
ollama create cybria -f ../ai-models/modelfiles/cybria.Modelfile

echo "Setup complete! You can now run start.sh to launch the application."
