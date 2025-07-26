# 🧠 Cybria AI Assistant

A sophisticated AI assistant with deep personality, multiple operational identities, and advanced 3D avatar.

## 📋 Project Overview

This project implements **Cybria**, a complex AI assistant built using Ollama with the `nous-hermes2:7b` model, featuring a React-based frontend with Three.js for 3D avatar rendering and a Python FastAPI backend.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- [Ollama](https://ollama.com) installed

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/cybria-ai-assistant.git
   cd cybria-ai-assistant
   ```

2. **Run the setup script**:
   - Windows:
     ```
     cd scripts
     .\setup.bat
     ```
   - Linux/macOS:
     ```
     cd scripts
     chmod +x setup.sh
     ./setup.sh
     ```

3. **Start the application**:
   - Windows:
     ```
     .\start.bat
     ```
   - Linux/macOS:
     ```
     ./start.sh
     ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Using Docker

```bash
docker-compose up
```

## 🏗️ Project Structure

```
cybria-ai-assistant/
├── frontend/                    # React frontend
├── backend/                     # FastAPI backend
├── ai-models/                   # AI models & Ollama modelfiles
├── voice-synthesis/             # TTS & voice processing
├── scripts/                     # Utility scripts
└── docker-compose.yml           # Docker configuration
```

## 🎭 Character Features

- **Rich Personality**: Deep emotional responses and complex motivations
- **Multiple Identities**: Switch between 6 distinct operational personas
- **Technical Expertise**: Advanced hacking and cybersecurity knowledge
- **3D Avatar**: Visual representation with emotional expressions
- **Tactical Intelligence**: Strategic thinking and detailed analysis

## 🛠️ Technical Stack

- **Frontend**: React, Three.js, React Three Fiber, Socket.io
- **Backend**: Python, FastAPI, WebSockets
- **AI**: Ollama, Nous-Hermes2:7b model
- **3D**: Three.js, GLB/VRM models

## 📝 Development

### Frontend Development

```bash
cd frontend
npm install
npm start
```

### Backend Development

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Ollama Model

```bash
cd ai-models
ollama create cybria -f modelfiles/cybria.Modelfile
ollama run cybria
```

## 📚 Documentation

- [Project Documentation](docs/README.md)
- [API Documentation](http://localhost:8000/docs) (when running)
- [Character Design](CYBRIA_PROJECT.MD)
- [Technical Stack](TECH_STACK.md)

## 🔮 Future Enhancements

- Voice synthesis and recognition
- Advanced 3D avatar with lip sync
- Memory system for conversation context
- Mobile application support

---

**Created by**: Kai Tran  
**Project Date**: July 2025  
**Version**: 0.1.0

*"In the digital realm, identity is fluid. But purpose... purpose remains constant."* - Cybria
