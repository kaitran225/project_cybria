import axios from 'axios';

// Create an axios instance with base URL and common headers
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// API endpoints
const API = {
  // Chat endpoints
  chat: {
    sendMessage: (message, identity) => 
      apiClient.post('/chat', { message, identity }),
    
    getHistory: () => 
      apiClient.get('/chat/history'),
  },
  
  // Voice endpoints
  voice: {
    synthesize: (text, emotion = 'neutral', identity = 'cybria') => 
      apiClient.post('/voice/synthesize', { text, emotion, identity }, {
        responseType: 'blob',
      }),
    
    recognize: (audioBlob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      return apiClient.post('/voice/recognize', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  },
  
  // Avatar endpoints
  avatar: {
    getAnimations: (identity = 'cybria') => 
      apiClient.get(`/avatar/animations?identity=${identity}`),
    
    getExpressions: (identity = 'cybria') => 
      apiClient.get(`/avatar/expressions?identity=${identity}`),
  },
  
  // Identity endpoints
  identity: {
    getAll: () => 
      apiClient.get('/identity'),
    
    switch: (identity) => 
      apiClient.post('/identity/switch', { identity }),
  },
};

// Request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common API errors
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data);
      
      // Handle authentication errors
      if (error.response.status === 401) {
        localStorage.removeItem('authToken');
        // Redirect to login in a real app
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.request);
    } else {
      // Error in request setup
      console.error('Request Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default API;
