import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import VoiceInput from './VoiceInput';
import IdentitySwitcher from './IdentitySwitcher';
import './Chat.css';

const ChatWindow = ({ onSendMessage, messages = [], activeIdentity, onIdentityChange }) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle sending message
  const handleSendMessage = () => {
    if (inputMessage.trim() === '') return;
    
    onSendMessage(inputMessage);
    setInputMessage('');
  };
  
  // Handle keyboard input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="chat-window">
      <div className="chat-header">
        <h2>Cybria AI Assistant</h2>
        <IdentitySwitcher 
          activeIdentity={activeIdentity} 
          onIdentityChange={onIdentityChange} 
        />
      </div>
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <MessageBubble 
            key={index}
            message={message.text}
            isUser={message.isUser}
            timestamp={message.timestamp}
            emotion={message.emotion}
            identity={message.identity}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
          rows={3}
        />
        <div className="chat-controls">
          <VoiceInput onVoiceInput={(text) => setInputMessage(text)} />
          <button onClick={handleSendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
