/**
 * GMAT Ascension - Timer Component
 * Countdown and elapsed time display
 */

class Timer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.mode = options.mode || 'elapsed'; // 'elapsed' or 'countdown'
    this.duration = options.duration || 0; // For countdown mode (seconds)
    this.warningThreshold = options.warningThreshold || 30; // Seconds
    this.onComplete = options.onComplete || (() => {});
    this.onWarning = options.onWarning || (() => {});
    
    this.startTime = null;
    this.elapsed = 0;
    this.remaining = this.duration;
    this.running = false;
    this.intervalId = null;
    this.warningTriggered = false;
  }

  /**
   * Render the timer
   */
  render() {
    this.container.innerHTML = `
      <div class="timer ${this.mode}">
        <span class="timer-icon">⏱</span>
        <span class="timer-display">
          <span class="timer-value">${this.formatTime(this.mode === 'countdown' ? this.duration : 0)}</span>
        </span>
      </div>
    `;
    
    this.displayEl = this.container.querySelector('.timer-value');
    this.timerEl = this.container.querySelector('.timer');
  }

  /**
   * Start the timer
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.startTime = Date.now() - (this.elapsed * 1000);
    
    this.intervalId = setInterval(() => this.tick(), 100);
    
    this.timerEl?.classList.add('running');
  }

  /**
   * Stop/pause the timer
   */
  stop() {
    this.running = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.timerEl?.classList.remove('running');
  }

  /**
   * Reset the timer
   */
  reset() {
    this.stop();
    this.elapsed = 0;
    this.remaining = this.duration;
    this.warningTriggered = false;
    
    this.timerEl?.classList.remove('warning', 'danger', 'complete');
    this.updateDisplay();
  }

  /**
   * Timer tick
   */
  tick() {
    if (!this.running) return;
    
    this.elapsed = (Date.now() - this.startTime) / 1000;
    
    if (this.mode === 'countdown') {
      this.remaining = Math.max(0, this.duration - this.elapsed);
      
      // Check warning threshold
      if (!this.warningTriggered && this.remaining <= this.warningThreshold) {
        this.warningTriggered = true;
        this.timerEl?.classList.add('warning');
        this.onWarning(this.remaining);
      }
      
      // Check if complete
      if (this.remaining <= 0) {
        this.stop();
        this.timerEl?.classList.add('complete');
        this.timerEl?.classList.remove('warning');
        this.onComplete();
      }
    }
    
    this.updateDisplay();
  }

  /**
   * Update the display
   */
  updateDisplay() {
    if (!this.displayEl) return;
    
    const time = this.mode === 'countdown' ? this.remaining : this.elapsed;
    this.displayEl.textContent = this.formatTime(time);
  }

  /**
   * Format time as MM:SS or H:MM:SS
   */
  formatTime(seconds) {
    const s = Math.floor(seconds);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsed() {
    return Math.round(this.elapsed);
  }

  /**
   * Get remaining time (countdown mode)
   */
  getRemaining() {
    return Math.round(this.remaining);
  }

  /**
   * Set the duration (countdown mode)
   */
  setDuration(seconds) {
    this.duration = seconds;
    this.remaining = seconds;
    this.updateDisplay();
  }

  /**
   * Add time (countdown mode)
   */
  addTime(seconds) {
    this.duration += seconds;
    this.remaining += seconds;
    this.updateDisplay();
  }

  /**
   * Check if running
   */
  isRunning() {
    return this.running;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
  }
}

// Export
window.Timer = Timer;
