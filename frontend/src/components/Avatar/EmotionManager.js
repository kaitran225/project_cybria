/**
 * Emotion Manager Class
 * Handles emotional state transitions for the Cybria avatar
 */
class EmotionManager {
  constructor() {
    // Possible emotional states
    this.emotions = {
      neutral: { blendshapes: {}, intensity: 0.0 },
      happy: { blendshapes: {}, intensity: 0.5 },
      angry: { blendshapes: {}, intensity: 0.8 },
      sad: { blendshapes: {}, intensity: 0.6 },
      surprised: { blendshapes: {}, intensity: 0.7 },
      calculating: { blendshapes: {}, intensity: 0.4 },
      vulnerable: { blendshapes: {}, intensity: 0.9 }
    };
    
    this.currentEmotion = 'neutral';
    this.emotionIntensity = 0.0;
    this.targetIntensity = 0.0;
    this.transitionSpeed = 0.05;
  }
  
  /**
   * Set the current emotion with optional intensity override
   * @param {string} emotion - Emotion name
   * @param {number} intensity - Optional intensity override (0.0-1.0)
   */
  setEmotion(emotion, intensity = null) {
    if (!this.emotions[emotion]) {
      console.warn(`Unknown emotion: ${emotion}`);
      return;
    }
    
    this.currentEmotion = emotion;
    this.targetIntensity = intensity !== null ? intensity : this.emotions[emotion].intensity;
  }
  
  /**
   * Blend to a new emotional state
   * @param {string} emotion - Target emotion
   * @param {number} transitionTime - Time to blend in seconds
   */
  blendToEmotion(emotion, transitionTime = 0.5) {
    if (!this.emotions[emotion]) {
      console.warn(`Unknown emotion: ${emotion}`);
      return;
    }
    
    this.currentEmotion = emotion;
    this.targetIntensity = this.emotions[emotion].intensity;
    this.transitionSpeed = 1.0 / (transitionTime * 60); // Assuming 60fps
  }
  
  /**
   * Apply emotion blendshapes to VRM model
   * @param {Object} vrm - VRM model instance
   */
  applyEmotionToVRM(vrm) {
    if (!vrm || !vrm.blendShapeProxy) {
      return;
    }
    
    const blendshapes = this.emotions[this.currentEmotion].blendshapes;
    
    // Apply each blendshape value based on current intensity
    Object.keys(blendshapes).forEach(key => {
      const value = blendshapes[key] * this.emotionIntensity;
      vrm.blendShapeProxy.setValue(key, value);
    });
  }
  
  /**
   * Update emotion state (called per frame)
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // Smooth transition between emotion intensities
    if (this.emotionIntensity !== this.targetIntensity) {
      if (this.emotionIntensity < this.targetIntensity) {
        this.emotionIntensity = Math.min(
          this.emotionIntensity + this.transitionSpeed, 
          this.targetIntensity
        );
      } else {
        this.emotionIntensity = Math.max(
          this.emotionIntensity - this.transitionSpeed,
          this.targetIntensity
        );
      }
    }
    
    // In a complete implementation, we would update expression maps, etc.
  }
  
  /**
   * Get current emotion data
   * @returns {Object} Current emotion data
   */
  getCurrentEmotionData() {
    return {
      name: this.currentEmotion,
      intensity: this.emotionIntensity,
      blendshapes: this.emotions[this.currentEmotion].blendshapes
    };
  }
}

export default EmotionManager;
