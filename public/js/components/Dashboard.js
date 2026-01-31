/**
 * GMAT Ascension - Dashboard Component
 * Main dashboard view with readiness gauge, daily plan, and stats
 */

class Dashboard {
  constructor(container) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    this.data = null;
    this.components = {};
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    this.render();
    await this.loadData();
  }

  /**
   * Load dashboard data
   */
  async loadData() {
    try {
      this.showLoading();
      
      // Load all data in parallel
      const [session, stats, plan, readiness] = await Promise.all([
        window.api.getTodaySession().catch(() => null),
        window.api.getStats().catch(() => null),
        window.api.getDailyPlan().catch(() => null),
        window.api.getReadiness().catch(() => null)
      ]);

      this.data = { session, stats, plan, readiness };
      this.renderData();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  /**
   * Render the dashboard structure
   */
  render() {
    this.container.innerHTML = `
      <div class="dashboard">
        <!-- Hero Section -->
        <section class="dashboard-hero">
          <div class="dashboard-greeting" id="dashboard-greeting"></div>
          <div class="dashboard-readiness" id="readiness-gauge"></div>
        </section>

        <!-- Quick Actions -->
        <section class="dashboard-actions">
          <h3 class="section-title">Start Training</h3>
          <div class="action-grid" id="training-modes"></div>
        </section>

        <!-- Daily Plan -->
        <section class="dashboard-plan">
          <h3 class="section-title">Today's Plan</h3>
          <div id="daily-plan"></div>
        </section>

        <!-- Quick Stats -->
        <section class="dashboard-stats">
          <h3 class="section-title">Your Stats</h3>
          <div class="stats-grid" id="quick-stats"></div>
        </section>

        <!-- Recent Activity -->
        <section class="dashboard-activity">
          <h3 class="section-title">Recent Activity</h3>
          <div id="recent-activity"></div>
        </section>
      </div>
    `;

    // Initialize sub-components
    this.components.readiness = new ReadinessGauge('#readiness-gauge');
    this.components.dailyPlan = new DailyPlan('#daily-plan');
    this.components.quickStats = new QuickStats('#quick-stats');
    
    this.renderGreeting();
    this.renderTrainingModes();
  }

  /**
   * Render greeting based on time of day
   */
  renderGreeting() {
    const greeting = document.getElementById('dashboard-greeting');
    const hour = new Date().getHours();
    let timeGreeting;
    
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    greeting.innerHTML = `
      <h1 class="greeting-text">${timeGreeting}</h1>
      <p class="greeting-sub">Ready to level up your GMAT skills?</p>
    `;
  }

  /**
   * Render training mode buttons
   */
  renderTrainingModes() {
    const modesContainer = document.getElementById('training-modes');
    const modes = [
      {
        id: 'sprint',
        name: 'Sprint',
        icon: '⚡',
        description: '10 quick questions',
        color: 'var(--mode-sprint)'
      },
      {
        id: 'endurance',
        name: 'Endurance',
        icon: '🎯',
        description: '25 questions, timed',
        color: 'var(--mode-endurance)'
      },
      {
        id: 'review',
        name: 'Review',
        icon: '📚',
        description: 'Practice weak areas',
        color: 'var(--mode-review)'
      },
      {
        id: 'mixed',
        name: 'Mixed',
        icon: '🔀',
        description: 'Adaptive practice',
        color: 'var(--mode-mixed)'
      }
    ];

    modesContainer.innerHTML = modes.map(mode => `
      <button class="mode-card" data-mode="${mode.id}" style="--mode-color: ${mode.color}">
        <span class="mode-icon">${mode.icon}</span>
        <span class="mode-name">${mode.name}</span>
        <span class="mode-desc">${mode.description}</span>
        <span class="kbd-hint"><kbd>${mode.id[0].toUpperCase()}</kbd></span>
      </button>
    `).join('');

    // Add click handlers
    modesContainer.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        this.startTraining(card.dataset.mode);
      });
    });

    // Register keyboard shortcuts
    modes.forEach(mode => {
      window.keyboard.register(mode.id[0], () => {
        this.startTraining(mode.id);
      }, {
        context: 'dashboard',
        description: `Start ${mode.name} mode`
      });
    });
  }

  /**
   * Render data after loading
   */
  renderData() {
    if (!this.data) return;

    // Update readiness gauge
    if (this.data.readiness) {
      this.components.readiness.update(this.data.readiness);
    }

    // Update daily plan
    if (this.data.plan) {
      this.components.dailyPlan.update(this.data.plan);
    }

    // Update quick stats
    if (this.data.stats) {
      this.components.quickStats.update(this.data.stats);
    }

    // Render recent activity
    this.renderRecentActivity();
  }

  /**
   * Render recent activity
   */
  renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    const session = this.data?.session;

    if (!session || !session.attempts || session.attempts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">No activity today</div>
          <div class="empty-state-description">Start a training session to see your progress</div>
        </div>
      `;
      return;
    }

    const recent = session.attempts.slice(0, 5);
    container.innerHTML = `
      <div class="activity-list">
        ${recent.map(attempt => `
          <div class="activity-item ${attempt.isCorrect ? 'correct' : 'incorrect'}">
            <div class="activity-icon">${attempt.isCorrect ? '✓' : '✗'}</div>
            <div class="activity-info">
              <div class="activity-skill">${attempt.skill || 'Question'}</div>
              <div class="activity-time">${this.formatTime(attempt.timeSpent)}s</div>
            </div>
            <div class="activity-difficulty">
              <span class="badge badge-${attempt.difficulty || 'medium'}">${attempt.difficulty || 'Medium'}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Start training mode
   */
  async startTraining(mode) {
    try {
      const targetQuestions = {
        sprint: 10,
        endurance: 25,
        review: 15,
        mixed: 20
      };

      const block = await window.api.startBlock({
        mode,
        targetQuestions: targetQuestions[mode]
      });

      // Navigate to training view
      if (window.gmatApp && window.gmatApp.showView) {
        window.gmatApp.showView('question-view', { block });
      }
    } catch (error) {
      console.error('Failed to start training:', error);
      if (window.gmatApp && window.gmatApp.showToast) {
        window.gmatApp.showToast('Failed to start training', 'error');
      }
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    document.querySelectorAll('.dashboard section > div:not(.section-title)').forEach(el => {
      if (!el.classList.contains('action-grid')) {
        el.innerHTML = `
          <div class="skeleton-loader">
            <div class="skeleton skeleton-text" style="width: 80%"></div>
            <div class="skeleton skeleton-text" style="width: 60%"></div>
            <div class="skeleton skeleton-text" style="width: 40%"></div>
          </div>
        `;
      }
    });
  }

  /**
   * Show error state
   */
  showError(message) {
    // Show toast or inline error
    if (window.gmatApp && window.gmatApp.showToast) {
      window.gmatApp.showToast(message, 'error');
    }
  }

  /**
   * Format time in seconds
   */
  formatTime(seconds) {
    return Math.round(seconds || 0);
  }

  /**
   * Refresh dashboard data
   */
  async refresh() {
    await this.loadData();
  }

  /**
   * Cleanup
   */
  destroy() {
    // Unregister shortcuts
    ['s', 'e', 'r', 'm'].forEach(key => {
      window.keyboard.unregister(key, 'dashboard');
    });
  }
}

// Export
window.Dashboard = Dashboard;
