import React from 'react';
import './Chat.css';

const MessageBubble = ({ message, isUser, timestamp, emotion, identity }) => {
  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get message bubble class based on sender
  const bubbleClass = isUser ? 'message-bubble user' : 'message-bubble assistant';
  
  // Get identity icon or initial
  const getIdentityIcon = (identity) => {
    if (!identity || identity.toLowerCase() === 'cybria') {
      return 'C';
    }
    
    const icons = {
      riley: 'R',   // Web developer
      nina: 'N',    // Software engineer
      luna: 'L',    // Tattoo artist
      sophie: 'S',  // Graphic designer
      victoria: 'V' // Security consultant
    };
    
    return icons[identity.toLowerCase()] || 'C';
  };
  
  // Get identity color
  const getIdentityColor = (identity) => {
    if (!identity || identity.toLowerCase() === 'cybria') {
      return '#6a0dad'; // Purple for main Cybria identity
    }
    
    const colors = {
      riley: '#4169e1',   // Royal blue for web developer
      nina: '#228b22',    // Forest green for software engineer
      luna: '#800080',    // Purple for tattoo artist
      sophie: '#ff69b4',  // Pink for graphic designer
      victoria: '#b22222' // Firebrick for security consultant
    };
    
    return colors[identity.toLowerCase()] || '#6a0dad';
  };
  
  return (
    <div className={bubbleClass}>
      {!isUser && (
        <div 
          className="identity-icon" 
          style={{ backgroundColor: getIdentityColor(identity) }}
        >
          {getIdentityIcon(identity)}
        </div>
      )}
      <div className="message-content">
        <div className="message-text">{message}</div>
        <div className="message-metadata">
          {timestamp && (
            <span className="message-time">{formatTime(timestamp)}</span>
          )}
          {!isUser && emotion && (
            <span className="message-emotion">{emotion}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
