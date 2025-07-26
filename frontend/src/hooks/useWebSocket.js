import { useEffect, useRef, useState, useCallback } from 'react';

// WebSocket connection states
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

const useWebSocket = (url, options = {}) => {
  const {
    onOpen,
    onMessage,
    onClose,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    autoReconnect = true,
  } = options;
  
  const [readyState, setReadyState] = useState(CLOSED);
  const [reconnectCount, setReconnectCount] = useState(0);
  
  const socket = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socket.current?.readyState === OPEN) return;
    
    try {
      // Close existing connection if any
      if (socket.current) {
        socket.current.close();
      }
      
      // Create new WebSocket connection
      socket.current = new WebSocket(url);
      setReadyState(CONNECTING);
      
      // Setup event handlers
      socket.current.onopen = (event) => {
        setReadyState(OPEN);
        setReconnectCount(0);
        if (onOpen) onOpen(event);
      };
      
      socket.current.onmessage = (event) => {
        if (onMessage) onMessage(event);
      };
      
      socket.current.onclose = (event) => {
        setReadyState(CLOSED);
        
        if (onClose) onClose(event);
        
        // Auto reconnect if enabled and not max attempts
        if (autoReconnect && reconnectCount < reconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };
      
      socket.current.onerror = (error) => {
        if (onError) onError(error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      if (onError) onError(error);
    }
  }, [url, onOpen, onMessage, onClose, onError, reconnectAttempts, reconnectInterval, autoReconnect, reconnectCount]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket.current) {
      setReadyState(CLOSING);
      socket.current.close();
    }
  }, []);
  
  // Send message through WebSocket
  const sendMessage = useCallback((data) => {
    if (socket.current?.readyState === OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socket.current.send(message);
      return true;
    }
    return false;
  }, []);
  
  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    readyState,
    sendMessage,
    connect,
    disconnect,
    isConnecting: readyState === CONNECTING,
    isOpen: readyState === OPEN,
    isClosing: readyState === CLOSING,
    isClosed: readyState === CLOSED,
    reconnectCount,
  };
};

export default useWebSocket;
