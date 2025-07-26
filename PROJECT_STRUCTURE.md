# 📁 Cybria AI Assistant - Project Structure

Complete file and folder organization for the Cybria AI assistant project.

## 🏗️ Root Directory Structure

```
cybria-ai-assistant/
├── 📁 frontend/                    # Web interface & 3D avatar
├── 📁 backend/                     # API server & core logic
├── 📁 ai-models/                   # AI models & training
├── 📁 voice-synthesis/             # TTS & voice training
├── 📁 3d-assets/                   # 3D models & animations
├── 📁 training-data/               # Character training datasets
├── 📁 docs/                        # Documentation
├── 📁 scripts/                     # Utility scripts
├── 📁 deployment/                  # Docker & deployment configs
├── 📁 tests/                       # Test suites
├── 📄 docker-compose.yml           # Development environment
├── 📄 docker-compose.prod.yml      # Production environment
├── 📄 README.md                   # Project overview
├── 📄 TECH_STACK.md               # Technical documentation
├── 📄 .gitignore                  # Git ignore rules
└── 📄 LICENSE                     # Project license
```

## 🖥️ Frontend Structure (`frontend/`)

```
frontend/
├── 📁 public/
│   ├── 📄 index.html
│   ├── 📄 manifest.json
│   └── 📁 icons/
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 Avatar/              # 3D avatar components
│   │   │   ├── 📄 CybriaAvatar.jsx
│   │   │   ├── 📄 AnimationController.js
│   │   │   ├── 📄 EmotionManager.js
│   │   │   └── 📄 LipSyncController.js
│   │   ├── 📁 Chat/               # Chat interface
│   │   │   ├── 📄 ChatWindow.jsx
│   │   │   ├── 📄 MessageBubble.jsx
│   │   │   ├── 📄 VoiceInput.jsx
│   │   │   └── 📄 IdentitySwitcher.jsx
│   │   ├── 📁 UI/                 # General UI components
│   │   │   ├── 📄 Header.jsx
│   │   │   ├── 📄 Sidebar.jsx
│   │   │   ├── 📄 Settings.jsx
│   │   │   └── 📄 StatusIndicator.jsx
│   │   └── 📁 Utils/              # Utility components
│   │       ├── 📄 WebSocketManager.js
│   │       ├── 📄 AudioProcessor.js
│   │       └── 📄 CameraCapture.js
│   ├── 📁 hooks/
│   │   ├── 📄 useWebSocket.js
│   │   ├── 📄 useVoiceRecognition.js
│   │   ├── 📄 useAvatarAnimation.js
│   │   └── 📄 useChatHistory.js
│   ├── 📁 services/
│   │   ├── 📄 apiClient.js
│   │   ├── 📄 websocketService.js
│   │   ├── 📄 audioService.js
│   │   └── 📄 storageService.js
│   ├── 📁 store/                  # State management
│   │   ├── 📄 chatStore.js
│   │   ├── 📄 avatarStore.js
│   │   ├── 📄 settingsStore.js
│   │   └── 📄 authStore.js
│   ├── 📁 styles/
│   │   ├── 📄 globals.css
│   │   ├── 📄 avatar.css
│   │   └── 📄 chat.css
│   ├── 📁 assets/
│   │   ├── 📁 images/
│   │   ├── 📁 sounds/
│   │   └── 📁 fonts/
│   ├── 📄 App.jsx
│   ├── 📄 index.js
│   └── 📄 reportWebVitals.js
├── 📄 package.json
├── 📄 package-lock.json
├── 📄 webpack.config.js
├── 📄 .env.development
├── 📄 .env.production
└── 📄 README.md
```

## ⚙️ Backend Structure (`backend/`)

```
backend/
├── 📁 app/
│   ├── 📁 api/
│   │   ├── 📁 v1/
│   │   │   ├── 📄 __init__.py
│   │   │   ├── 📄 chat.py          # Chat endpoints
│   │   │   ├── 📄 voice.py         # Voice synthesis endpoints
│   │   │   ├── 📄 avatar.py        # Avatar animation endpoints
│   │   │   ├── 📄 identity.py      # Identity switching endpoints
│   │   │   └── 📄 training.py      # Model training endpoints
│   │   └── 📄 __init__.py
│   ├── 📁 core/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 config.py           # Configuration settings
│   │   ├── 📄 security.py         # Security utilities
│   │   ├── 📄 database.py         # Database connections
│   │   └── 📄 logging.py          # Logging configuration
│   ├── 📁 services/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 ollama_service.py   # Ollama integration
│   │   ├── 📄 tts_service.py      # Text-to-speech service
│   │   ├── 📄 emotion_service.py  # Emotion analysis
│   │   ├── 📄 memory_service.py   # Conversation memory
│   │   └── 📄 animation_service.py # Avatar animation control
│   ├── 📁 models/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 chat_models.py      # Chat data models
│   │   ├── 📄 user_models.py      # User data models
│   │   ├── 📄 voice_models.py     # Voice data models
│   │   └── 📄 identity_models.py  # Identity data models
│   ├── 📁 utils/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 audio_utils.py      # Audio processing utilities
│   │   ├── 📄 text_utils.py       # Text processing utilities
│   │   ├── 📄 encryption_utils.py # Data encryption
│   │   └── 📄 validation_utils.py # Input validation
│   ├── 📁 websocket/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 connection_manager.py # WebSocket connections
│   │   ├── 📄 chat_handler.py     # Real-time chat
│   │   ├── 📄 voice_handler.py    # Real-time voice
│   │   └── 📄 animation_handler.py # Real-time animation
│   ├── 📄 __init__.py
│   └── 📄 main.py                 # FastAPI application entry
├── 📁 alembic/                    # Database migrations
│   ├── 📁 versions/
│   ├── 📄 env.py
│   └── 📄 script.py.mako
├── 📄 requirements.txt
├── 📄 requirements-dev.txt
├── 📄 alembic.ini
├── 📄 .env.example
├── 📄 .env.development
├── 📄 .env.production
├── 📄 Dockerfile
└── 📄 README.md
```

## 🧠 AI Models Structure (`ai-models/`)

```
ai-models/
├── 📁 ollama/
│   ├── 📁 modelfiles/
│   │   ├── 📄 cybria.Modelfile     # Main Cybria personality
│   │   ├── 📄 riley.Modelfile      # Web developer identity
│   │   ├── 📄 nina.Modelfile       # Software engineer identity
│   │   ├── 📄 luna.Modelfile       # Tattoo artist identity
│   │   ├── 📄 victoria.Modelfile   # Security consultant identity
│   │   └── 📄 sophie.Modelfile     # Graphic designer identity
│   ├── 📁 system-prompts/
│   │   ├── 📄 base_personality.txt
│   │   ├── 📄 emotional_triggers.txt
│   │   ├── 📄 technical_expertise.txt
│   │   └── 📄 identity_contexts.txt
│   └── 📁 custom-models/          # Fine-tuned models
├── 📁 training/
│   ├── 📁 scripts/
│   │   ├── 📄 fine_tune_lora.py   # LoRA fine-tuning
│   │   ├── 📄 merge_adapters.py   # Model merging
│   │   ├── 📄 evaluate_model.py   # Model evaluation
│   │   └── 📄 export_model.py     # Model export
│   ├── 📁 configs/
│   │   ├── 📄 lora_config.yaml
│   │   ├── 📄 training_config.yaml
│   │   └── 📄 evaluation_config.yaml
│   └── 📁 checkpoints/            # Training checkpoints
├── 📁 embeddings/
│   ├── 📁 vector-store/           # ChromaDB data
│   ├── 📄 embedding_service.py
│   └── 📄 similarity_search.py
├── 📁 memory/
│   ├── 📄 conversation_memory.py
│   ├── 📄 long_term_memory.py
│   └── 📄 episodic_memory.py
└── 📄 README.md
```

## 🎤 Voice Synthesis Structure (`voice-synthesis/`)

```
voice-synthesis/
├── 📁 tts/
│   ├── 📁 models/
│   │   ├── 📁 coqui/              # Coqui TTS models
│   │   ├── 📁 tortoise/           # Tortoise TTS models
│   │   └── 📁 custom/             # Custom trained models
│   ├── 📁 services/
│   │   ├── 📄 tts_engine.py       # TTS engine wrapper
│   │   ├── 📄 voice_cloning.py    # Voice cloning service
│   │   ├── 📄 emotion_tts.py      # Emotional TTS
│   │   └── 📄 realtime_tts.py     # Real-time synthesis
│   └── 📁 configs/
│       ├── 📄 coqui_config.yaml
│       ├── 📄 tortoise_config.yaml
│       └── 📄 voice_profiles.yaml
├── 📁 voice-training/
│   ├── 📁 data/
│   │   ├── 📁 raw/                # Raw audio samples
│   │   ├── 📁 processed/          # Processed audio
│   │   └── 📁 transcripts/        # Text transcriptions
│   ├── 📁 scripts/
│   │   ├── 📄 preprocess_audio.py # Audio preprocessing
│   │   ├── 📄 train_voice_model.py # Voice model training
│   │   ├── 📄 evaluate_voice.py   # Voice quality evaluation
│   │   └── 📄 voice_conversion.py # RVC voice conversion
│   └── 📁 models/
│       ├── 📁 checkpoints/        # Training checkpoints
│       └── 📁 final/              # Final trained models
├── 📁 audio-processing/
│   ├── 📄 audio_utils.py          # Audio utilities
│   ├── 📄 noise_reduction.py      # Noise reduction
│   ├── 📄 voice_activity_detection.py # VAD
│   └── 📄 audio_enhancement.py    # Audio enhancement
├── 📁 real-time/
│   ├── 📄 stream_processor.py     # Real-time audio processing
│   ├── 📄 latency_optimizer.py    # Latency optimization
│   └── 📄 buffer_manager.py       # Audio buffer management
└── 📄 README.md
```

## 🎮 3D Assets Structure (`3d-assets/`)

```
3d-assets/
├── 📁 characters/
│   ├── 📁 cybria/
│   │   ├── 📁 base-model/
│   │   │   ├── 📄 cybria_base.glb
│   │   │   ├── 📄 cybria_base.vrm
│   │   │   └── 📄 cybria_textures/
│   │   ├── 📁 expressions/
│   │   │   ├── 📄 neutral.json
│   │   │   ├── 📄 happy.json
│   │   │   ├── 📄 angry.json
│   │   │   ├── 📄 sad.json
│   │   │   ├── 📄 surprised.json
│   │   │   └── 📄 calculating.json
│   │   ├── 📁 outfits/
│   │   │   ├── 📄 casual.glb
│   │   │   ├── 📄 tactical.glb
│   │   │   └── 📄 formal.glb
│   │   └── 📁 accessories/
│   └── 📁 identity-variants/
│       ├── 📁 riley/              # Web developer appearance
│       ├── 📁 nina/               # Software engineer appearance
│       ├── 📁 luna/               # Tattoo artist appearance
│       ├── 📁 victoria/           # Security consultant appearance
│       └── 📁 sophie/             # Graphic designer appearance
├── 📁 animations/
│   ├── 📁 idle/
│   │   ├── 📄 thinking.fbx
│   │   ├── 📄 waiting.fbx
│   │   └── 📄 breathing.fbx
│   ├── 📁 speaking/
│   │   ├── 📄 gestures.fbx
│   │   ├── 📄 lip_sync.fbx
│   │   └── 📄 emphatic.fbx
│   ├── 📁 listening/
│   │   ├── 📄 attentive.fbx
│   │   ├── 📄 curious.fbx
│   │   └── 📄 analyzing.fbx
│   ├── 📁 emotional/
│   │   ├── 📄 vulnerable.fbx
│   │   ├── 📄 defensive.fbx
│   │   ├── 📄 confident.fbx
│   │   └── 📄 calculating.fbx
│   └── 📁 transitions/
│       ├── 📄 identity_switch.fbx
│       └── 📄 emotion_blend.fbx
├── 📁 environments/
│   ├── 📁 backgrounds/
│   │   ├── 📄 cyberpunk_room.glb
│   │   ├── 📄 office_space.glb
│   │   └── 📄 digital_void.glb
│   └── 📁 lighting/
│       ├── 📄 neon_lighting.json
│       └── 📄 natural_lighting.json
├── 📁 materials/
│   ├── 📁 skin/
│   ├── 📁 hair/
│   ├── 📁 clothing/
│   └── 📁 accessories/
└── 📄 README.md
```

## 📚 Training Data Structure (`training-data/`)

```
training-data/
├── 📁 personality/
│   ├── 📄 core_traits.jsonl       # 5000+ personality examples
│   ├── 📄 emotional_responses.jsonl # 3000+ emotional triggers
│   ├── 📄 tactical_thinking.jsonl # 2000+ strategic examples
│   └── 📄 vulnerability_moments.jsonl # 1000+ vulnerable responses
├── 📁 identities/
│   ├── 📄 riley_developer.jsonl   # Web developer persona
│   ├── 📄 nina_engineer.jsonl     # Software engineer persona
│   ├── 📄 luna_artist.jsonl       # Tattoo artist persona
│   ├── 📄 victoria_consultant.jsonl # Security consultant persona
│   └── 📄 sophie_designer.jsonl   # Graphic designer persona
├── 📁 technical/
│   ├── 📄 hacking_scenarios.jsonl # 4000+ cybersecurity examples
│   ├── 📄 programming_help.jsonl  # 3000+ coding assistance
│   ├── 📄 system_analysis.jsonl   # 2000+ technical analysis
│   └── 📄 security_expertise.jsonl # 2500+ security knowledge
├── 📁 dialogue/
│   ├── 📄 casual_conversation.jsonl # 10000+ natural dialogue
│   ├── 📄 mission_briefings.jsonl # 1500+ task-oriented dialogue
│   ├── 📄 relationship_building.jsonl # 2000+ trust-building
│   └── 📄 conflict_resolution.jsonl # 1000+ difficult conversations
├── 📁 backstory/
│   ├── 📄 childhood_memories.jsonl # Early life experiences
│   ├── 📄 kai_relationship.jsonl  # Kai Tran interactions
│   ├── 📄 kvi_organization.jsonl  # Organization details
│   └── 📄 betrayal_discovery.jsonl # Recent revelations
├── 📁 voice-samples/
│   ├── 📁 cybria-base/
│   │   ├── 📄 neutral_tone/       # 500+ neutral samples
│   │   ├── 📄 emotional_range/    # 300+ emotional samples
│   │   └── 📄 technical_speech/   # 200+ technical explanations
│   ├── 📁 identity-voices/
│   │   ├── 📄 riley_samples/      # Casual, enthusiastic
│   │   ├── 📄 nina_samples/       # Professional, confident
│   │   ├── 📄 luna_samples/       # Edgy, artistic
│   │   ├── 📄 victoria_samples/   # Authoritative, expert
│   │   └── 📄 sophie_samples/     # Creative, friendly
│   └── 📁 emotional-variants/
│       ├── 📄 vulnerable/         # Soft, hurt voice
│       ├── 📄 calculating/        # Cold, analytical
│       ├── 📄 protective/         # Fierce, defensive
│       └── 📄 nostalgic/          # Wistful, remembering
├── 📁 evaluation/
│   ├── 📄 personality_tests.jsonl # Personality consistency tests
│   ├── 📄 knowledge_tests.jsonl   # Technical knowledge tests
│   ├── 📄 identity_tests.jsonl    # Identity switching tests
│   └── 📄 emotional_tests.jsonl   # Emotional response tests
└── 📄 README.md
```

## 📖 Documentation Structure (`docs/`)

```
docs/
├── 📁 user-guides/
│   ├── 📄 getting_started.md
│   ├── 📄 identity_switching.md
│   ├── 📄 voice_training.md
│   └── 📄 troubleshooting.md
├── 📁 api-docs/
│   ├── 📄 rest_api.md
│   ├── 📄 websocket_api.md
│   ├── 📄 authentication.md
│   └── 📄 rate_limiting.md
├── 📁 development/
│   ├── 📄 setup_development.md
│   ├── 📄 contribution_guide.md
│   ├── 📄 coding_standards.md
│   └── 📄 testing_guide.md
├── 📁 deployment/
│   ├── 📄 docker_setup.md
│   ├── 📄 cloud_deployment.md
│   ├── 📄 monitoring_setup.md
│   └── 📄 backup_strategy.md
├── 📁 architecture/
│   ├── 📄 system_overview.md
│   ├── 📄 database_schema.md
│   ├── 📄 security_design.md
│   └── 📄 performance_considerations.md
├── 📁 character-design/
│   ├── 📄 personality_framework.md
│   ├── 📄 identity_management.md
│   ├── 📄 emotional_modeling.md
│   └── 📄 backstory_consistency.md
└── 📄 README.md
```

## 🔧 Scripts Structure (`scripts/`)

```
scripts/
├── 📁 setup/
│   ├── 📄 install_dependencies.sh # Install all dependencies
│   ├── 📄 setup_ollama.sh         # Ollama setup
│   ├── 📄 setup_models.sh         # Download and setup models
│   └── 📄 setup_database.sh       # Database initialization
├── 📁 development/
│   ├── 📄 start_dev.sh            # Start development environment
│   ├── 📄 build_frontend.sh       # Build frontend
│   ├── 📄 run_tests.sh            # Run all tests
│   └── 📄 lint_code.sh            # Code linting
├── 📁 training/
│   ├── 📄 prepare_training_data.py # Prepare training datasets
│   ├── 📄 train_personality.py    # Train personality model
│   ├── 📄 train_voice.py          # Train voice models
│   └── 📄 evaluate_models.py      # Model evaluation
├── 📁 deployment/
│   ├── 📄 build_containers.sh     # Build Docker containers
│   ├── 📄 deploy_production.sh    # Production deployment
│   ├── 📄 backup_data.sh          # Data backup
│   └── 📄 monitor_health.sh       # Health monitoring
├── 📁 utilities/
│   ├── 📄 clean_cache.sh          # Clean model cache
│   ├── 📄 migrate_database.py     # Database migrations
│   ├── 📄 export_conversations.py # Export chat history
│   └── 📄 import_voice_samples.py # Import voice training data
└── 📄 README.md
```

## 🚀 Deployment Structure (`deployment/`)

```
deployment/
├── 📁 docker/
│   ├── 📄 Dockerfile.frontend     # Frontend container
│   ├── 📄 Dockerfile.backend      # Backend container
│   ├── 📄 Dockerfile.ollama       # Ollama container
│   ├── 📄 Dockerfile.voice        # Voice synthesis container
│   └── 📄 Dockerfile.nginx        # Nginx reverse proxy
├── 📁 kubernetes/
│   ├── 📄 namespace.yaml
│   ├── 📄 frontend-deployment.yaml
│   ├── 📄 backend-deployment.yaml
│   ├── 📄 ollama-deployment.yaml
│   ├── 📄 voice-deployment.yaml
│   ├── 📄 ingress.yaml
│   └── 📄 configmap.yaml
├── 📁 compose/
│   ├── 📄 docker-compose.yml      # Development
│   ├── 📄 docker-compose.prod.yml # Production
│   ├── 📄 docker-compose.test.yml # Testing
│   └── 📄 .env.template           # Environment variables
├── 📁 monitoring/
│   ├── 📄 prometheus.yml
│   ├── 📄 grafana-dashboard.json
│   ├── 📄 alerting-rules.yml
│   └── 📄 docker-compose.monitoring.yml
├── 📁 nginx/
│   ├── 📄 nginx.conf
│   ├── 📄 ssl.conf
│   └── 📄 cybria.conf
├── 📁 ssl/
│   ├── 📄 generate_certs.sh
│   └── 📄 renew_certs.sh
└── 📄 README.md
```

## 🧪 Tests Structure (`tests/`)

```
tests/
├── 📁 unit/
│   ├── 📁 frontend/
│   │   ├── 📁 components/
│   │   ├── 📁 hooks/
│   │   └── 📁 services/
│   ├── 📁 backend/
│   │   ├── 📁 api/
│   │   ├── 📁 services/
│   │   └── 📁 utils/
│   └── 📁 ai-models/
│       ├── 📄 test_personality.py
│       ├── 📄 test_identity_switching.py
│       └── 📄 test_emotional_responses.py
├── 📁 integration/
│   ├── 📄 test_chat_flow.py
│   ├── 📄 test_voice_synthesis.py
│   ├── 📄 test_avatar_animation.py
│   └── 📄 test_websocket_communication.py
├── 📁 e2e/
│   ├── 📄 test_complete_conversation.js
│   ├── 📄 test_identity_switching.js
│   ├── 📄 test_voice_interaction.js
│   └── 📄 test_avatar_response.js
├── 📁 performance/
│   ├── 📄 test_response_time.py
│   ├── 📄 test_voice_latency.py
│   ├── 📄 test_memory_usage.py
│   └── 📄 test_concurrent_users.py
├── 📁 fixtures/
│   ├── 📁 chat_data/
│   ├── 📁 voice_samples/
│   └── 📁 model_responses/
├── 📁 mocks/
│   ├── 📄 mock_ollama.py
│   ├── 📄 mock_tts.py
│   └── 📄 mock_websocket.js
└── 📄 README.md
```

## 📝 Configuration Files

### Root Level Configuration
```yaml
# .gitignore
# Dependencies
node_modules/
__pycache__/
*.pyc

# Models and large files
*.bin
*.safetensors
ai-models/custom-models/
voice-synthesis/models/
3d-assets/raw/

# Environment variables
.env
.env.local
.env.production

# Build outputs
dist/
build/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
```

### Package Configuration
```json
// package.json (root)
{
  "name": "cybria-ai-assistant",
  "version": "1.0.0",
  "description": "Advanced AI assistant with 3D avatar and voice synthesis",
  "scripts": {
    "dev": "docker-compose up",
    "build": "docker-compose -f docker-compose.prod.yml build",
    "test": "npm run test:frontend && npm run test:backend",
    "deploy": "scripts/deployment/deploy_production.sh"
  },
  "workspaces": [
    "frontend",
    "backend",
    "scripts"
  ]
}
```

## 🔄 Data Flow Architecture

```
User Input → Frontend → WebSocket → Backend → Ollama → Response
    ↓                                    ↓
Voice Input → TTS Service → Audio → Avatar Animation
    ↓                                    ↓
Chat History → Memory Service → Vector DB → Long-term Memory
```

## 🚀 Quick Start Commands

```bash
# Clone and setup
git clone https://github.com/your-username/cybria-ai-assistant.git
cd cybria-ai-assistant

# Setup development environment
./scripts/setup/install_dependencies.sh
./scripts/setup/setup_ollama.sh
./scripts/setup/setup_models.sh

# Start development
./scripts/development/start_dev.sh

# Access points:
# Frontend: http://localhost:3000
# API: http://localhost:8000
# Ollama: http://localhost:11434
```

## 📊 File Size Estimates

| Directory | Estimated Size | Purpose |
|-----------|---------------|---------|
| `ai-models/` | ~15-20 GB | Ollama models and training data |
| `voice-synthesis/` | ~5-10 GB | TTS models and voice samples |
| `3d-assets/` | ~2-5 GB | 3D models and animations |
| `training-data/` | ~1-2 GB | Text training datasets |
| `frontend/build/` | ~100-200 MB | Built frontend assets |
| `backend/` | ~50-100 MB | Python backend code |

**Total Project Size**: ~25-40 GB (depending on model choices)

---

**Project Structure Version**: 1.0  
**Last Updated**: July 2025  
**Maintained by**: Kai Tran  

*"Organization is the foundation of any successful operation. Every file has its place, every directory serves a purpose."* - Cybria
