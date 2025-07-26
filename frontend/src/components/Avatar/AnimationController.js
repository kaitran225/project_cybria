/**
 * Animation Controller Class
 * Manages animations for the Cybria avatar
 */
class AnimationController {
  constructor() {
    this.animations = {};
    this.currentAnimation = null;
    this.mixer = null;
    this.model = null;
    this.clock = null;
  }

  /**
   * Initialize the animation controller with a 3D model
   * @param {Object} model - The loaded 3D model
   * @param {Object} animations - Animation clips
   * @param {Object} clock - Three.js clock for timing
   */
  init(model, animations, clock) {
    this.model = model;
    this.clock = clock;
    
    if (model) {
      this.mixer = new THREE.AnimationMixer(model);
      
      // Store animations by name
      animations.forEach(clip => {
        this.animations[clip.name] = clip;
      });
    }
  }
  
  /**
   * Play an animation by name
   * @param {string} animationName - Name of the animation to play
   * @param {boolean} loop - Whether the animation should loop
   */
  playAnimation(animationName, loop = true) {
    if (!this.mixer || !this.animations[animationName]) {
      console.warn(`Animation ${animationName} not found`);
      return;
    }
    
    // Stop current animation if playing
    if (this.currentAnimation) {
      this.currentAnimation.stop();
    }
    
    // Play new animation
    const action = this.mixer.clipAction(this.animations[animationName]);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    action.reset().play();
    this.currentAnimation = action;
  }
  
  /**
   * Transition between animations
   * @param {string} fromAnimation - Current animation name
   * @param {string} toAnimation - Target animation name
   * @param {number} duration - Transition duration in seconds
   */
  transitionTo(fromAnimation, toAnimation, duration = 1.0) {
    if (!this.mixer || !this.animations[fromAnimation] || !this.animations[toAnimation]) {
      console.warn(`Cannot transition: animation not found`);
      return;
    }
    
    const current = this.mixer.clipAction(this.animations[fromAnimation]);
    const next = this.mixer.clipAction(this.animations[toAnimation]);
    
    current.enabled = true;
    next.enabled = true;
    
    current.setEffectiveTimeScale(1);
    current.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(0);
    
    next.crossFadeFrom(current, duration, true);
    next.play();
    
    this.currentAnimation = next;
  }
  
  /**
   * Update animation mixer on each frame
   */
  update() {
    if (this.mixer && this.clock) {
      this.mixer.update(this.clock.getDelta());
    }
  }
}

export default AnimationController;
