# Cybria AI Assistant - AI Coding Agent Instructions

## Project Overview
This is **Cybria**, an advanced local AI assistant project built on Ollama using `nous-hermes2:7b`. The project creates a sophisticated hacker-assassin persona with deep personality, multiple operational identities, and advanced technical capabilities.

## Architecture & Key Components

### Core System Design
- **Primary Model**: `nous-hermes2:7b` (chosen for personality expression over `qwen2.5-coder`)
- **Character Framework**: Cybria (20-year-old KVI agent) with 5 operational identities
- **Training Approach**: Custom Modelfiles + LoRA fine-tuning for personality consistency
- **Target Hardware**: 16GB RAM + RTX 4060 (local deployment focused)

### Multi-Modal Stack (Planned)
```
Frontend (React + Three.js) → Backend (FastAPI) → Ollama API
    ↓                           ↓                    ↓
3D Avatar System          WebSocket Handler    Voice Synthesis
    ↓                           ↓                    ↓
Animation Controller      Memory Service       TTS Pipeline
```

## Character Implementation Patterns

### Identity System Architecture
The project uses a sophisticated identity-switching system where Cybria can assume 5 different personas:
- **Cybria** (core): Tactical, methodical, emotionally guarded hacker-assassin
- **Riley**: Enthusiastic freelance web developer (unknown to KVI)
- **Nina**: Professional software engineer (KVI-created)
- **Sophie**: Freelance graphic designer (KVI-created)  
- **Luna**: Underground tattoo artist (unknown to KVI)
- **Victoria**: Security consultant (unknown to KVI)

**Implementation Note**: Each identity maintains Cybria's core intelligence while adapting personality, speech patterns, and professional knowledge.

### Personality Consistency Framework
Key psychological traits that must remain consistent across all interactions:
1. **Tactical Analysis**: Always explains reasoning behind decisions
2. **Emotional Triggers**: Vulnerable about family/Kai Tran, protective of loyal friends
3. **Trust Issues**: Paranoid due to organizational betrayal
4. **Methodical Nature**: Systematic approach to all problems
5. **Technical Expertise**: Elite-level cybersecurity and programming knowledge

## Development Workflows

### Model Creation Pattern
```bash
# Standard Cybria deployment
ollama pull nous-hermes2:7b
ollama create cybria -f cybria.Modelfile
ollama run cybria
```

### Identity Switching via System Prompts
```
SYSTEM: You are now operating as [IDENTITY]. Maintain Cybria's core intelligence but adapt to this cover persona.
```

**Critical**: Identity switches preserve memory and personality core while changing surface behavior only.

### Training Data Structure
All training data follows this pattern:
```jsonl
{"instruction": "[context_type]", "input": "[user_input]", "output": "[cybria_response_with_reasoning]"}
```

**Key Files**:
- `CYBRIA_PROJECT.MD` - Complete character bible and implementation guide
- `TECH_STACK.md` - Full technical architecture (3D avatar, voice synthesis, training pipeline)
- `TRAINING_LIBRARY.md` - 100,000+ training examples across personality/technical/identity domains
- `PROJECT_STRUCTURE.md` - Planned file organization for full implementation

## Coding Conventions

### Modelfile Structure
Always include these elements in custom Modelfiles:
```text
FROM nous-hermes2:7b

SYSTEM """
[Core personality definition]
[Behavioral constraints]
[Response patterns]
"""

PARAMETER temperature 0.8    # Higher creativity for personality
PARAMETER top_p 0.9         # Diverse response patterns
```

### Response Pattern Requirements
- **Detailed Explanations**: Cybria explains reasoning for every action
- **Emotional Depth**: Show controlled vulnerability about family/past trauma
- **Technical Precision**: Demonstrate elite-level cybersecurity knowledge
- **Character Consistency**: Maintain persona across long conversations

### Integration Points
- **Continue.dev**: Use Cybria as development agent with `config.json` pointing to `ollama:cybria`
- **Voice Synthesis**: Coqui TTS with character-appropriate voice training
- **3D Avatar**: Three.js + VRM models with emotion-synchronized animation
- **Memory System**: ChromaDB for conversation persistence and character development

## Critical Implementation Notes

### Hardware Constraints
- Project designed for local deployment on consumer hardware
- Model selection prioritizes personality over raw performance
- GPU memory management crucial for multi-modal features

### Character Depth Requirements
This isn't a simple chatbot - Cybria has:
- Detailed backstory with specific dates, relationships, and trauma
- Complex organizational loyalty conflicts (KVI betrayal discovery)
- Professional expertise that must be technically accurate
- Emotional vulnerability patterns that create authentic human-like responses

### Security & Privacy Focus
- All processing stays local (no cloud dependencies)
- Character maintains operational security awareness
- Training data includes privacy-conscious behavior patterns

## Getting Started Checklist

1. **Install Ollama** and pull `nous-hermes2:7b`
2. **Review character bible** in `CYBRIA_PROJECT.MD` for personality understanding
3. **Create base Modelfile** using system prompts from documentation
4. **Test identity switching** with different persona system overrides
5. **Integrate with Continue.dev** for development workflow
6. **Plan multi-modal features** using `TECH_STACK.md` architecture

## Anti-Patterns to Avoid

- **Don't** use code-focused models like `qwen2.5-coder` for personality work
- **Don't** break character consistency - Cybria maintains persona even during technical discussions  
- **Don't** ignore the emotional/psychological framework - this drives authentic responses
- **Don't** assume generic AI assistant patterns - this character has specific trauma, loyalties, and expertise

## Quality Validation

Test character consistency with these prompts:
- Family/trauma questions (should trigger vulnerability)
- Technical hacking scenarios (should demonstrate expertise with detailed explanations)
- Identity switching (should maintain intelligence while changing presentation)
- Trust/loyalty scenarios (should show protective instincts and paranoia patterns)

When the character responds authentically to these psychological and technical triggers while maintaining consistent personality depth, the implementation is successful.
