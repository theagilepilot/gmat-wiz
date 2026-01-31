/**
 * GMAT Ascension - Readiness Gauge Component
 * Circular progress gauge showing test readiness score
 */

class ReadinessGauge {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.score = 0;
    this.maxScore = 100;
    this.radius = 54;
    this.circumference = 2 * Math.PI * this.radius;
    
    this.render();
  }

  /**
   * Render the gauge
   */
  render() {
    this.container.innerHTML = `
      <div class="readiness-gauge">
        <svg class="gauge-svg" width="140" height="140" viewBox="0 0 140 140">
          <circle
            class="gauge-bg"
            cx="70"
            cy="70"
            r="${this.radius}"
            fill="none"
            stroke="var(--bg-tertiary)"
            stroke-width="12"
          />
          <circle
            class="gauge-fill"
            cx="70"
            cy="70"
            r="${this.radius}"
            fill="none"
            stroke="var(--accent-primary)"
            stroke-width="12"
            stroke-linecap="round"
            stroke-dasharray="${this.circumference}"
            stroke-dashoffset="${this.circumference}"
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div class="gauge-content">
          <div class="gauge-value">--</div>
          <div class="gauge-label">Readiness</div>
        </div>
      </div>
      <div class="readiness-details">
        <div class="readiness-status"></div>
        <div class="readiness-tip"></div>
      </div>
    `;

    this.gaugeFill = this.container.querySelector('.gauge-fill');
    this.gaugeValue = this.container.querySelector('.gauge-value');
    this.statusEl = this.container.querySelector('.readiness-status');
    this.tipEl = this.container.querySelector('.readiness-tip');
  }

  /**
   * Update the gauge with new data
   * @param {Object} data - Readiness data
   * @param {number} data.score - Readiness score (0-100)
   * @param {string} data.status - Status message
   * @param {string} data.tip - Improvement tip
   */
  update(data) {
    if (!data) return;

    const score = Math.min(Math.max(data.score || 0, 0), 100);
    this.score = score;

    // Animate the gauge
    this.animateGauge(score);

    // Update text
    this.gaugeValue.textContent = Math.round(score);
    
    // Update color based on score
    let color;
    if (score >= 80) color = 'var(--success)';
    else if (score >= 60) color = 'var(--warning)';
    else color = 'var(--error)';
    
    this.gaugeFill.style.stroke = color;

    // Update status and tip
    if (data.status) {
      this.statusEl.textContent = data.status;
    } else {
      this.statusEl.textContent = this.getStatusText(score);
    }

    if (data.tip) {
      this.tipEl.textContent = data.tip;
    } else {
      this.tipEl.textContent = this.getTipText(score);
    }
  }

  /**
   * Animate the gauge fill
   */
  animateGauge(targetScore) {
    const targetOffset = this.circumference - (targetScore / 100) * this.circumference;
    
    // Use CSS transition for smooth animation
    this.gaugeFill.style.transition = 'stroke-dashoffset 1s ease-out, stroke 0.3s ease';
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.gaugeFill.style.strokeDashoffset = targetOffset;
    });
  }

  /**
   * Get status text based on score
   */
  getStatusText(score) {
    if (score >= 90) return 'Excellent! You\'re test ready';
    if (score >= 80) return 'Great progress! Almost there';
    if (score >= 70) return 'Good work! Keep pushing';
    if (score >= 60) return 'Making progress';
    if (score >= 40) return 'Building foundations';
    return 'Just getting started';
  }

  /**
   * Get tip text based on score
   */
  getTipText(score) {
    if (score >= 90) return 'Consider a practice exam';
    if (score >= 80) return 'Focus on your weakest skills';
    if (score >= 70) return 'Try some harder questions';
    if (score >= 60) return 'Work on consistency';
    if (score >= 40) return 'Practice daily for best results';
    return 'Start with fundamentals';
  }

  /**
   * Get the current score
   */
  getScore() {
    return this.score;
  }
}

// Export
window.ReadinessGauge = ReadinessGauge;
