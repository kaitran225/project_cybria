#!/usr/bin/env python3
"""
Cybria AI Assistant Web Server
A Flask-based web interface for the Cybria AI character using Ollama.
"""

import os
import json
import datetime
import uuid
import requests
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import socket

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'cybria_secret_key_kvi_2025'  # In production, use environment variable
CORS(app)

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"
CHAT_DATA_FILE = os.path.join("data", "chat_sessions.json")
MODEL_NAME = "cybria"  # Default Cybria model

class CybriaServer:
    def __init__(self):
        self.ensure_data_directory()
        self.chat_sessions = self.load_chat_data()
        
    def ensure_data_directory(self):
        """Ensure the data directory exists"""
        os.makedirs("data", exist_ok=True)
        
    def load_chat_data(self):
        """Load existing chat sessions from file"""
        try:
            if os.path.exists(CHAT_DATA_FILE):
                with open(CHAT_DATA_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading chat data: {e}")
        return {}
    
    def save_chat_data(self):
        """Save chat sessions to file"""
        try:
            with open(CHAT_DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.chat_sessions, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving chat data: {e}")
    
    def get_session_id(self):
        """Get or create session ID"""
        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())
        return session['session_id']
    
    def add_message_to_session(self, session_id, role, content, identity="cybria"):
        """Add message to chat session"""
        if session_id not in self.chat_sessions:
            self.chat_sessions[session_id] = {
                "created": datetime.datetime.now().isoformat(),
                "messages": [],
                "current_identity": identity
            }
        
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.datetime.now().isoformat(),
            "identity": identity
        }
        
        self.chat_sessions[session_id]["messages"].append(message)
        self.save_chat_data()
    
    def get_session_messages(self, session_id):
        """Get messages for a specific session"""
        if session_id in self.chat_sessions:
            return self.chat_sessions[session_id]["messages"]
        return []
    
    def call_ollama_api(self, model, messages):
        """Call Ollama API for chat completion"""
        try:
            # Format messages for Ollama API
            formatted_messages = []
            for msg in messages:
                formatted_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            payload = {
                "model": model,
                "messages": formatted_messages,
                "stream": False
            }
            
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('message', {}).get('content', 'No response generated.')
            else:
                return f"Error: Ollama API returned status {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            return "Error: Cannot connect to Ollama. Please ensure Ollama is running and the Cybria model is available."
        except requests.exceptions.Timeout:
            return "Error: Request timed out. The AI is taking too long to respond."
        except Exception as e:
            return f"Error: {str(e)}"
    
    def switch_identity(self, identity):
        """Switch Cybria's operational identity"""
        identity_prompts = {
            "cybria": "You are Cybria, the core identity. Maintain your full tactical persona.",
            "riley": "You are now operating as Riley, the freelance web developer. Be enthusiastic about coding while maintaining Cybria's intelligence.",
            "nina": "You are now operating as Nina, the software engineer. Professional and tech-focused while keeping Cybria's core personality.",
            "sophie": "You are now operating as Sophie, the freelance graphic designer. Creative and design-focused with Cybria's analytical nature.",
            "luna": "You are now operating as Luna, the underground tattoo artist. Artistic and edgy while maintaining Cybria's street-smart awareness.",
            "victoria": "You are now operating as Victoria, the security consultant. Professional security expert with Cybria's tactical knowledge."
        }
        
        return identity_prompts.get(identity.lower(), identity_prompts["cybria"])

# Initialize server
cybria_server = CybriaServer()

@app.route('/')
def index():
    """Serve the desktop web interface"""
    return render_template('index.html')

@app.route('/mobile')
def mobile():
    """Serve the mobile web interface"""
    return render_template('mobile.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages"""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        identity = data.get('identity', 'cybria').lower()
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        session_id = cybria_server.get_session_id()
        
        # Add user message to session
        cybria_server.add_message_to_session(session_id, "user", user_message, identity)
        
        # Get recent conversation history (last 10 messages for context)
        messages = cybria_server.get_session_messages(session_id)
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        # Add identity switching system message if needed
        if identity != "cybria":
            identity_prompt = cybria_server.switch_identity(identity)
            recent_messages.insert(0, {
                "role": "system",
                "content": identity_prompt
            })
        
        # Call Ollama API
        model_name = MODEL_NAME  # Could be dynamic based on identity
        ai_response = cybria_server.call_ollama_api(model_name, recent_messages)
        
        # Add AI response to session
        cybria_server.add_message_to_session(session_id, "assistant", ai_response, identity)
        
        return jsonify({
            'response': ai_response,
            'identity': identity,
            'session_id': session_id
        })
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/identity', methods=['POST'])
def switch_identity():
    """Switch operational identity"""
    try:
        data = request.get_json()
        identity = data.get('identity', 'cybria').lower()
        
        valid_identities = ['cybria', 'riley', 'nina', 'sophie', 'luna', 'victoria']
        if identity not in valid_identities:
            return jsonify({'error': 'Invalid identity'}), 400
        
        session_id = cybria_server.get_session_id()
        
        # Add identity switch message to session
        switch_message = f"*Identity switched to {identity.title()}*"
        cybria_server.add_message_to_session(session_id, "system", switch_message, identity)
        
        return jsonify({
            'success': True,
            'identity': identity,
            'message': f'Switched to {identity.title()} identity'
        })
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/history')
def get_history():
    """Get chat history for current session"""
    try:
        session_id = cybria_server.get_session_id()
        messages = cybria_server.get_session_messages(session_id)
        
        return jsonify({
            'messages': messages,
            'session_id': session_id
        })
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/clear', methods=['POST'])
def clear_history():
    """Clear chat history for current session"""
    try:
        session_id = cybria_server.get_session_id()
        
        if session_id in cybria_server.chat_sessions:
            del cybria_server.chat_sessions[session_id]
            cybria_server.save_chat_data()
        
        # Create new session
        session.pop('session_id', None)
        new_session_id = cybria_server.get_session_id()
        
        return jsonify({
            'success': True,
            'session_id': new_session_id,
            'message': 'Chat history cleared'
        })
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/status')
def status():
    """Check server and Ollama status"""
    try:
        # Check Ollama connection
        ollama_status = "disconnected"
        model_available = False
        
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            if response.status_code == 200:
                ollama_status = "connected"
                models = response.json().get('models', [])
                model_available = any(model.get('name', '').startswith(MODEL_NAME) for model in models)
        except:
            pass
        
        return jsonify({
            'server_status': 'running',
            'ollama_status': ollama_status,
            'model_available': model_available,
            'model_name': MODEL_NAME,
            'active_sessions': len(cybria_server.chat_sessions)
        })
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

def get_local_ip():
    """Get local IPv4 address"""
    try:
        # Connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "127.0.0.1"

if __name__ == '__main__':
    print("🧠 Cybria AI Assistant Web Server")
    print("=" * 40)
    
    local_ip = get_local_ip()
    port = 8000
    
    print(f"Server starting on:")
    print(f"  Local:    http://127.0.0.1:{port}")
    print(f"  Network:  http://{local_ip}:{port}")
    print(f"  Mobile:   http://{local_ip}:{port}/mobile")
    print()
    print("Make sure Ollama is running with the Cybria model:")
    print("  ollama run cybria")
    print()
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    try:
        app.run(
            host='0.0.0.0',  # Listen on all interfaces
            port=port,
            debug=True,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
