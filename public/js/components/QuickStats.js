/**
 * GMAT Ascension - Quick Stats Component
 * Displays key performance metrics
 */

class QuickStats {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.stats = null;
    
    this.render();
  }

  /**
   * Render the component
   */
  render() {
    this.container.innerHTML = `
      <div class="stats-loading">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    `;
  }

  /**
   * Update with stats data
   * @param {Object} stats - Statistics data
   */
  update(stats) {
    if (!stats) return;
    this.stats = stats;

    const statItems = [
      {
        id: 'accuracy',
        label: 'Accuracy',
        value: `${Math.round(stats.accuracy || 0)}%`,
        trend: stats.accuracyTrend,
        color: this.getAccuracyColor(stats.accuracy)
      },
      {
        id: 'streak',
        label: 'Streak',
        value: `${stats.currentStreak || 0}`,
        subValue: 'days',
        icon: '🔥'
      },
      {
        id: 'level',
        label: 'Level',
        value: stats.level || 1,
        subValue: stats.levelName || 'Beginner',
        color: 'var(--accent-primary)'
      },
      {
        id: 'questions',
        label: 'Questions',
        value: this.formatNumber(stats.totalQuestions || 0),
        subValue: 'total'
      }
    ];

    this.container.innerHTML = statItems.map(stat => `
      <div class="stat-card" data-stat="${stat.id}">
        ${stat.icon ? `<div class="stat-icon">${stat.icon}</div>` : ''}
        <div class="stat-value" ${stat.color ? `style="color: ${stat.color}"` : ''}>
          ${stat.value}
        </div>
        <div class="stat-label">${stat.label}</div>
        ${stat.subValue ? `<div class="stat-sub">${stat.subValue}</div>` : ''}
        ${stat.trend !== undefined ? this.renderTrend(stat.trend) : ''}
      </div>
    `).join('');
  }

  /**
   * Render trend indicator
   */
  renderTrend(trend) {
    if (trend === 0 || trend === undefined) return '';
    
    const isPositive = trend > 0;
    const icon = isPositive ? '↑' : '↓';
    const className = isPositive ? 'positive' : 'negative';
    
    return `
      <div class="stat-trend ${className}">
        ${icon} ${Math.abs(Math.round(trend))}%
      </div>
    `;
  }

  /**
   * Get color based on accuracy
   */
  getAccuracyColor(accuracy) {
    if (accuracy >= 80) return 'var(--success)';
    if (accuracy >= 60) return 'var(--warning)';
    return 'var(--error)';
  }

  /**
   * Format large numbers
   */
  formatNumber(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  /**
   * Update a single stat
   */
  updateStat(statId, value) {
    const statEl = this.container.querySelector(`[data-stat="${statId}"] .stat-value`);
    if (statEl) {
      statEl.textContent = value;
    }
  }

  /**
   * Animate stat change
   */
  animateStatChange(statId, newValue) {
    const statEl = this.container.querySelector(`[data-stat="${statId}"]`);
    if (statEl) {
      statEl.classList.add('stat-updated');
      setTimeout(() => {
        statEl.classList.remove('stat-updated');
      }, 500);
    }
    this.updateStat(statId, newValue);
  }
}

// Export
window.QuickStats = QuickStats;
