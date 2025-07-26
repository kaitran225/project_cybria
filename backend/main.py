"""
Main application file for Cybria AI Assistant backend
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import asyncio
import uvicorn
import logging
from datetime import datetime

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Cybria AI Assistant API",
    description="Backend API for Cybria AI Assistant",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- Data Models -----

class ChatMessage(BaseModel):
    """Chat message model"""
    message: str
    identity: Optional[str] = "cybria"


class ChatResponse(BaseModel):
    """Chat response model"""
    message: str
    emotion: str
    identity: str


class VoiceRequest(BaseModel):
    """Voice synthesis request model"""
    text: str
    emotion: Optional[str] = "neutral"
    identity: Optional[str] = "cybria"


class IdentitySwitch(BaseModel):
    """Identity switch request model"""
    identity: str


# ----- WebSocket Manager -----

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        """Connect a new WebSocket client"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection: {len(self.active_connections)} active connections")
    
    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket client"""
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected: {len(self.active_connections)} active connections")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific client"""
        await websocket.send_text(json.dumps(message))
    
    async def broadcast(self, message: Dict[str, Any]):
        """Send a message to all connected clients"""
        for connection in self.active_connections:
            await connection.send_text(json.dumps(message))


# Initialize connection manager
manager = ConnectionManager()


# ----- API Routes -----

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Cybria AI Assistant API"}


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": app.version
    }


# Chat Endpoints

@app.post("/api/v1/chat", response_model=ChatResponse)
async def send_message(chat_message: ChatMessage):
    """Process a chat message and return response"""
    try:
        # In a real implementation, this would call Ollama or another LLM
        # For now, just echo the message back
        
        # Simulate processing time
        await asyncio.sleep(1)
        
        # Create response
        response = ChatResponse(
            message=f"Echo: {chat_message.message}",
            emotion="neutral",
            identity=chat_message.identity
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/chat/history")
async def get_chat_history():
    """Get chat history"""
    # In a real implementation, this would fetch from a database
    return {"messages": []}


# Voice Endpoints

@app.post("/api/v1/voice/synthesize")
async def synthesize_voice(voice_request: VoiceRequest):
    """Synthesize voice from text"""
    try:
        # In a real implementation, this would call a TTS service
        # For now, just return a success message
        return {"status": "success", "message": "Voice synthesis would happen here"}
    
    except Exception as e:
        logger.error(f"Error synthesizing voice: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/voice/recognize")
async def recognize_speech():
    """Recognize speech from audio"""
    try:
        # In a real implementation, this would use speech recognition
        # For now, just return a placeholder text
        return {"text": "This is simulated speech recognition text"}
    
    except Exception as e:
        logger.error(f"Error recognizing speech: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Identity Endpoints

@app.get("/api/v1/identity")
async def get_identities():
    """Get all available identities"""
    return {
        "identities": [
            {"id": "cybria", "name": "Cybria", "description": "Elite Hacker-Assassin"},
            {"id": "riley", "name": "Riley", "description": "Freelance Web Developer"},
            {"id": "nina", "name": "Nina", "description": "Software Engineer"},
            {"id": "luna", "name": "Luna", "description": "Tattoo Artist"},
            {"id": "victoria", "name": "Victoria", "description": "Security Consultant"},
            {"id": "sophie", "name": "Sophie", "description": "Graphic Designer"}
        ]
    }


@app.post("/api/v1/identity/switch")
async def switch_identity(identity_switch: IdentitySwitch):
    """Switch active identity"""
    try:
        # In a real implementation, this would update the AI model prompt
        # For now, just return success
        return {"status": "success", "identity": identity_switch.identity}
    
    except Exception as e:
        logger.error(f"Error switching identity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Log received message
            logger.info(f"Received WebSocket message: {message_data}")
            
            # Process message based on type
            message_type = message_data.get("type", "unknown")
            
            if message_type == "chat_message":
                # Process chat message
                user_message = message_data.get("message", "")
                identity = message_data.get("identity", "cybria")
                
                # Echo user message back to all clients
                await manager.broadcast({
                    "type": "chat_message",
                    "message": user_message,
                    "isUser": True,
                    "timestamp": datetime.now().isoformat(),
                    "identity": identity
                })
                
                # In a real implementation, send to Ollama/LLM and get response
                # For now, simulate a response
                await asyncio.sleep(1)
                
                # Send AI response
                await manager.broadcast({
                    "type": "chat_message",
                    "message": f"I'm Cybria, responding to your message: \"{user_message}\"",
                    "isUser": False,
                    "timestamp": datetime.now().isoformat(),
                    "emotion": "calculating",
                    "identity": identity
                })
                
                # Update emotion
                await manager.broadcast({
                    "type": "emotion_update",
                    "emotion": "calculating"
                })
            
            elif message_type == "identity_switch":
                # Process identity switch
                identity = message_data.get("identity", "cybria")
                
                # Broadcast identity change
                await manager.broadcast({
                    "type": "identity_switch",
                    "identity": identity
                })
            
            else:
                # Unknown message type
                logger.warning(f"Unknown WebSocket message type: {message_type}")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket)


# Run app with uvicorn if executed directly
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
