# Cybria AI Assistant Web Interface

A sophisticated web interface for interacting with the Cybria AI character through Ollama. Features both desktop and mobile-optimized interfaces with identity switching, real-time chat, and tactical AI assistance.

## 🚀 Quick Start

### Prerequisites
- **Python 3.7+** with pip
- **Ollama** installed and running
- **nous-hermes2:7b** model downloaded

### Automated Setup
```bash
cd e:\project_cybria\web_interface
python setup.py
```

### Manual Setup
1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install and setup Ollama:**
   ```bash
   # Download Ollama from https://ollama.com
   ollama pull nous-hermes2:7b
   ollama create cybria -f cybria.Modelfile
   ```

3. **Start the server:**
   ```bash
   python server.py
   ```

4. **Access the interface:**
   - Desktop: http://127.0.0.1:8000
   - Mobile: http://127.0.0.1:8000/mobile
   - Network: http://[your-ip]:8000

## 🎭 Features

### Cybria AI Character
- **Core Identity**: 20-year-old elite hacker-assassin from KVI organization
- **Personality**: Tactical, methodical, emotionally guarded with vulnerability about family
- **Expertise**: Elite cybersecurity, network penetration, social engineering
- **Background**: Complex backstory involving family tragedy and organizational betrayal

### Identity Switching System
- **Cybria** (Core): Full tactical persona with hacking expertise
- **Riley**: Enthusiastic freelance web developer
- **Nina**: Professional software engineer for tech infiltration
- **Sophie**: Creative freelance graphic designer
- **Luna**: Underground tattoo artist with street connections
- **Victoria**: Security consultant with facility access expertise

### Web Interface Features
- **Dual Interface**: Optimized desktop and mobile versions
- **Real-time Chat**: WebSocket-like experience with typing indicators
- **Session Management**: Persistent chat history with temporary storage
- **Status Monitoring**: Real-time connection and model status
- **Identity Management**: Seamless switching between operational personas
- **Export Functionality**: Download chat history for analysis
- **Responsive Design**: Mobile-first approach with touch optimization

## 🔧 Technical Architecture

### Backend Stack
- **Flask**: Lightweight web framework for API endpoints
- **Ollama Integration**: Direct API communication with local AI models
- **JSON Storage**: Temporary chat session storage in project files
- **CORS Support**: Cross-origin resource sharing for development

### Frontend Stack
- **Vanilla JavaScript**: No framework dependencies for maximum compatibility
- **CSS Grid/Flexbox**: Modern responsive layout techniques
- **Progressive Enhancement**: Works on all modern browsers
- **Touch Optimization**: Mobile gesture support and viewport handling

### API Endpoints
- `POST /api/chat` - Send message to AI with identity context
- `POST /api/identity` - Switch operational identity
- `GET /api/history` - Retrieve chat session history
- `POST /api/clear` - Clear current session history
- `GET /api/status` - Check server and Ollama connectivity

## 📱 Interface Comparison

### Desktop Interface
- **Sidebar**: Identity selector, status panel, and controls
- **Main Chat**: Large message area with detailed formatting
- **Advanced Features**: Full character counter, detailed status monitoring
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for new lines

### Mobile Interface
- **Header**: Compact identity selector and connection status
- **Touch-Optimized**: Swipe gestures and touch-friendly buttons
- **Quick Actions**: Modal menu for common functions
- **Responsive Input**: Auto-resizing textarea with character limits
- **Export Function**: Download chat history on mobile devices

## 🧠 Character Implementation

### Personality Consistency
The Cybria character maintains consistent psychological traits across all interactions:

- **Tactical Analysis**: Always explains reasoning behind decisions
- **Emotional Triggers**: Shows vulnerability about family/Kai Tran
- **Trust Issues**: Paranoid due to organizational betrayal
- **Methodical Nature**: Systematic approach to all problems
- **Technical Expertise**: Demonstrates elite-level cybersecurity knowledge

### Response Patterns
- Begins with tactical observations: `*analyzes situation*`
- Shows emotional shifts: `*expression hardens*`, `*voice becomes quieter*`
- Maintains professional demeanor even when vulnerable
- Provides detailed technical explanations with reasoning
- Adapts personality based on active operational identity

## 🔒 Security & Privacy

### Local Processing
- All AI processing happens locally through Ollama
- No cloud dependencies or external API calls
- Chat data stored temporarily in local JSON files
- Full control over data retention and privacy

### Operational Security (OpSec)
- Character maintains security awareness in responses
- Identity switching preserves operational security patterns
- No sensitive information logged in clear text
- Session isolation prevents cross-contamination

## 📊 Data Storage

### Chat Sessions Format
```json
{
  "session_id": {
    "created": "2025-07-26T10:30:00",
    "messages": [
      {
        "role": "user|assistant|system",
        "content": "message content",
        "timestamp": "2025-07-26T10:30:15",
        "identity": "cybria|riley|nina|sophie|luna|victoria"
      }
    ],
    "current_identity": "cybria"
  }
}
```

### File Structure
```
web_interface/
├── server.py                 # Main Flask application
├── setup.py                  # Automated setup script
├── requirements.txt          # Python dependencies
├── cybria.Modelfile         # Ollama model configuration
├── templates/
│   ├── index.html           # Desktop interface
│   └── mobile.html          # Mobile interface
├── static/                  # Static assets (if needed)
└── data/
    └── chat_sessions.json   # Temporary chat storage
```

## 🚨 Troubleshooting

### Common Issues

**"Cannot connect to Ollama"**
```bash
# Check if Ollama is running
ollama list

# Start Ollama if needed
ollama serve

# Verify model is available
ollama run cybria
```

**"Model not found"**
```bash
# Create the Cybria model
ollama create cybria -f cybria.Modelfile

# Test the model
ollama run cybria "Hello Cybria"
```

**"Python packages missing"**
```bash
# Install dependencies
pip install -r requirements.txt

# Or individually
pip install Flask Flask-CORS requests
```

**"Server won't start"**
- Check if port 8000 is already in use
- Ensure Python has proper permissions
- Verify all files are in correct directory structure

### Debug Mode
Enable Flask debug mode for development:
```python
# In server.py, change:
app.run(host='0.0.0.0', port=8000, debug=True)
```

### Status Checking
Monitor system status:
```bash
# Check server status
curl http://localhost:8000/api/status

# Check Ollama directly  
curl http://localhost:11434/api/tags
```

## 🔄 Development Workflow

### Character Testing
Test character consistency with these prompts:
- Family questions (should trigger vulnerability)
- Technical hacking scenarios (should show expertise)
- Identity switching (should maintain intelligence)
- Trust/loyalty scenarios (should show protective instincts)

### Model Customization
Edit `cybria.Modelfile` to adjust:
- **Personality traits**: Modify PERSONALITY section
- **Response patterns**: Adjust BEHAVIORAL PATTERNS
- **Technical knowledge**: Update expertise descriptions
- **Temperature settings**: Fine-tune creativity (0.7-0.9)

### Interface Customization
- **Colors**: Edit CSS variables for theming
- **Layout**: Modify responsive breakpoints
- **Features**: Add new API endpoints in `server.py`

## 🌐 Network Configuration

### Local Network Access
To access from other devices on your network:

1. **Find your IP address:**
   ```bash
   ipconfig  # Windows
   ifconfig  # Linux/Mac
   ```

2. **Update firewall rules** to allow port 8000

3. **Access from other devices:**
   ```
   Desktop: http://[your-ip]:8000
   Mobile:  http://[your-ip]:8000/mobile
   ```

### Port Configuration
Change the default port by modifying `server.py`:
```python
app.run(host='0.0.0.0', port=8080)  # Use port 8080 instead
```

## 📈 Performance Optimization

### Hardware Requirements
- **Minimum**: 8GB RAM, CPU with AVX2 support
- **Recommended**: 16GB RAM, NVIDIA RTX 4060 or better
- **Storage**: 10GB free space for models and cache

### Model Performance
- **Temperature**: 0.8 (balanced creativity/consistency)
- **Context Length**: 4096 tokens (configurable in Modelfile)
- **Response Time**: 2-10 seconds depending on hardware

### Web Interface Performance
- **Bundling**: No build process required, pure vanilla JS
- **Caching**: Browser caches static assets automatically
- **Memory**: Minimal footprint, suitable for mobile devices

## 🔮 Future Enhancements

### Planned Features
- **Voice Integration**: Text-to-speech with character-appropriate voice
- **3D Avatar**: Three.js-based animated character representation
- **Memory Enhancement**: Vector database for long-term memory
- **Multi-language**: Support for multiple languages
- **Plugin System**: Extensible architecture for custom capabilities

### API Extensions
- **WebSocket Support**: Real-time bidirectional communication
- **Authentication**: User management and session security
- **Rate Limiting**: API throttling and abuse prevention
- **Logging**: Comprehensive audit trails and analytics

## 📚 Resources

### Documentation
- [Ollama Documentation](https://ollama.com/docs)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Cybria Character Bible](../CYBRIA_PROJECT.MD)

### Community
- [Ollama Discord](https://discord.gg/ollama)
- [Local LLM Reddit](https://reddit.com/r/LocalLLaMA)

## 📝 License

This project is part of the Cybria AI Assistant system. See the main project documentation for license details.

---

**Created by**: Kai Tran  
**Version**: 1.0  
**Last Updated**: July 2025

*"In the digital realm, interfaces are bridges between minds and machines."* - Cybria
