import React, { useState, useEffect } from 'react';
import CybriaAvatar from './components/Avatar/CybriaAvatar';
import ChatWindow from './components/Chat/ChatWindow';
import useWebSocket from './hooks/useWebSocket';
import API from './services/apiClient';
import './App.css';

function App() {
  // State management
  const [messages, setMessages] = useState([]);
  const [activeIdentity, setActiveIdentity] = useState('cybria');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [emotion, setEmotion] = useState('neutral');
  const [audioData, setAudioData] = useState(null);

  // WebSocket connection for real-time updates
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
  const { sendMessage, isOpen } = useWebSocket(wsUrl, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        switch (data.type) {
          case 'chat_message':
            addMessage(data.message, data.isUser, data.emotion, data.identity);
            break;
          case 'emotion_update':
            setEmotion(data.emotion);
            break;
          case 'identity_switch':
            setActiveIdentity(data.identity);
            break;
          case 'speech_start':
            setIsSpeaking(true);
            break;
          case 'speech_end':
            setIsSpeaking(false);
            break;
          case 'audio_data':
            setAudioData(data.audioData);
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    },
    onOpen: () => {
      console.log('WebSocket connected');
    },
    onClose: () => {
      console.log('WebSocket disconnected');
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
    autoReconnect: true,
  });

  // Load initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // In a real implementation, we would fetch message history from the API
        // For now, just add a welcome message
        const welcomeMessage = {
          text: "Hello, I'm Cybria. How can I assist you today?",
          isUser: false,
          timestamp: new Date().toISOString(),
          emotion: 'neutral',
          identity: 'cybria',
        };
        
        setMessages([welcomeMessage]);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    
    fetchMessages();
  }, []);

  // Add message to the chat
  const addMessage = (text, isUser, emotion = 'neutral', identity = activeIdentity) => {
    const newMessage = {
      text,
      isUser,
      timestamp: new Date().toISOString(),
      emotion,
      identity,
    };
    
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  // Handle sending user message
  const handleSendMessage = async (message) => {
    // Add user message to chat
    addMessage(message, true);
    
    try {
      // In a real implementation, we would send the message to the backend
      // and get a response. For now, simulate a response.
      
      // If WebSocket is open, send through that for real-time communication
      if (isOpen) {
        sendMessage({
          type: 'chat_message',
          message,
          identity: activeIdentity,
        });
      } else {
        // Fallback to REST API if WebSocket is not available
        // const response = await API.chat.sendMessage(message, activeIdentity);
        
        // Simulate API response
        setTimeout(() => {
          const response = {
            data: {
              message: `I'm Cybria, responding to your message: "${message}"`,
              emotion: 'calculating',
              identity: activeIdentity,
            }
          };
          
          // Add assistant response
          addMessage(
            response.data.message,
            false,
            response.data.emotion,
            response.data.identity
          );
          
          // Update emotion
          setEmotion(response.data.emotion);
        }, 1000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      addMessage('Sorry, I encountered an error processing your request.', false, 'neutral', activeIdentity);
    }
  };

  // Handle identity change
  const handleIdentityChange = async (identity) => {
    try {
      setActiveIdentity(identity);
      
      // In a real implementation, we would inform the backend about identity change
      // For now, just add a message
      
      const identityMessages = {
        cybria: "Switching to primary identity: Cybria. Elite hacker-assassin mode active.",
        riley: "Hey there! Riley here, your friendly web developer. How can I help with your website today?",
        nina: "Switching to Nina. Software engineer mode engaged. What code are we working on?",
        luna: "Luna here. *adjusts tattoo equipment* Looking for some ink or just here to chat?",
        victoria: "Victoria online. Security assessment mode activated. What systems need evaluation?",
        sophie: "Sophie at your service! Need some graphic design work? I'm ready to create something amazing."
      };
      
      // Add identity switch message
      addMessage(identityMessages[identity] || "Identity switched.", false, 'neutral', identity);
    } catch (error) {
      console.error('Error changing identity:', error);
    }
  };

  return (
    <div className="app">
      <div className="app-container">
        <div className="avatar-section">
          <CybriaAvatar 
            currentIdentity={activeIdentity}
            emotion={emotion}
            isSpeaking={isSpeaking}
            audioData={audioData}
          />
        </div>
        <div className="chat-section">
          <ChatWindow 
            messages={messages}
            onSendMessage={handleSendMessage}
            activeIdentity={activeIdentity}
            onIdentityChange={handleIdentityChange}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
