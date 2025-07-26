/**
 * Lip Sync Controller Class
 * Handles lip synchronization for speech
 */
class LipSyncController {
  constructor() {
    this.isActive = false;
    this.audioContext = null;
    this.analyzer = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.lastMouthOpenValue = 0;
    this.mouthDampening = 0.3; // Smoothing factor
    
    // Mouth related VRM blendshape keys
    this.mouthBlendshapes = {
      mouthOpen: 'mouthOpen',
      mouthA: 'mouthA',
      mouthO: 'mouthO',
      mouthE: 'mouthE'
    };
    
    this.setupAudioContext();
  }
  
  /**
   * Set up Web Audio API context and analyzer
   */
  setupAudioContext() {
    try {
      // Modern browsers require user interaction before creating AudioContext
      // This would be initialized after a user gesture in a real app
      this.audioContext = null; // new (window.AudioContext || window.webkitAudioContext)();
      
      if (this.audioContext) {
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 256;
        this.bufferLength = this.analyzer.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
      }
    } catch (error) {
      console.error('Audio context setup failed:', error);
    }
  }
  
  /**
   * Start lip sync with audio source
   * @param {MediaStream|AudioNode} audioSource - Audio source for lip sync
   */
  start(audioSource) {
    if (!this.audioContext || !this.analyzer) {
      console.warn('Audio context not initialized');
      return;
    }
    
    let source;
    
    if (audioSource instanceof MediaStream) {
      source = this.audioContext.createMediaStreamSource(audioSource);
    } else {
      source = audioSource;
    }
    
    source.connect(this.analyzer);
    this.isActive = true;
  }
  
  /**
   * Stop lip sync
   */
  stop() {
    this.isActive = false;
    this.lastMouthOpenValue = 0;
  }
  
  /**
   * Update lip sync based on audio data (called per frame)
   * @param {Object} vrm - VRM model instance
   */
  update(vrm) {
    if (!this.isActive || !this.analyzer || !vrm) {
      return;
    }
    
    // Get audio data from analyzer
    this.analyzer.getByteFrequencyData(this.dataArray);
    
    // Calculate audio energy in relevant frequency bands for speech
    let energy = 0;
    const speechBandStart = 2; // ~85Hz
    const speechBandEnd = 15;  // ~630Hz (typical speech frequencies)
    
    for (let i = speechBandStart; i < speechBandEnd; i++) {
      energy += this.dataArray[i];
    }
    
    // Normalize
    energy = energy / (speechBandEnd - speechBandStart) / 255;
    
    // Apply smoothing to avoid jitter
    this.lastMouthOpenValue = this.lastMouthOpenValue * this.mouthDampening + 
                              energy * (1 - this.mouthDampening);
    
    // Apply to VRM blendshapes if available
    if (vrm.blendShapeProxy) {
      vrm.blendShapeProxy.setValue(this.mouthBlendshapes.mouthOpen, this.lastMouthOpenValue);
      
      // More sophisticated implementations would determine vowel shapes
      // For now, just use mouthOpen with different intensities for the others
      vrm.blendShapeProxy.setValue(this.mouthBlendshapes.mouthA, this.lastMouthOpenValue * 0.8);
      vrm.blendShapeProxy.setValue(this.mouthBlendshapes.mouthO, this.lastMouthOpenValue * 0.5);
      vrm.blendShapeProxy.setValue(this.mouthBlendshapes.mouthE, this.lastMouthOpenValue * 0.3);
    }
  }
  
  /**
   * Process audio data for a specific time frame
   * Used when we have pre-recorded audio data
   * @param {Float32Array} audioData - Audio data array
   * @returns {number} Mouth open value (0.0-1.0)
   */
  processAudioFrame(audioData) {
    if (!audioData || audioData.length === 0) {
      return 0;
    }
    
    // Simple energy calculation in the audio frame
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    
    const energy = Math.min(1.0, sum / audioData.length * 5); // Scale up for visibility
    
    // Apply smoothing
    this.lastMouthOpenValue = this.lastMouthOpenValue * this.mouthDampening + 
                              energy * (1 - this.mouthDampening);
    
    return this.lastMouthOpenValue;
  }
}

export default LipSyncController;
