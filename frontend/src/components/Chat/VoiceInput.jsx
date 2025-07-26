import React, { useState, useRef } from 'react';
import './Chat.css';

const VoiceInput = ({ onVoiceInput }) => {
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Start voice recording
  const startListening = async () => {
    try {
      setErrorMessage('');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Store audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Process recorded audio when stopped
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // In a real implementation, we would:
        // 1. Send the audio to a speech-to-text service
        // 2. Get back the transcribed text
        // 3. Call onVoiceInput with the text
        
        // For this prototype, we'll simulate speech recognition
        setTimeout(() => {
          onVoiceInput("This is simulated voice input text");
          setIsListening(false);
        }, 1000);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setErrorMessage('Microphone access denied');
      setIsListening(false);
    }
  };
  
  // Stop voice recording
  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      // The onstop handler will process the recording
    }
  };
  
  return (
    <div className="voice-input">
      <button 
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopListening : startListening}
      >
        {isListening ? 'Stop' : 'Voice'}
      </button>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
    </div>
  );
};

export default VoiceInput;
