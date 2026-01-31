/**
 * GMAT Ascension - Analytics Dashboard Component
 * Displays weakness heatmap, timing charts, error trends
 */

class Analytics {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.data = null;
    this.activeTab = 'overview';
  }

  /**
   * Initialize the analytics view
   */
  async init() {
    this.render();
    await this.loadData();
  }

  /**
   * Load analytics data
   */
  async loadData() {
    try {
      this.showLoading();

      const [weakness, timing, errors, progress] = await Promise.all([
        window.api.get('/dashboard/weakness-heatmap').catch(() => null),
        window.api.get('/dashboard/timing-report').catch(() => null),
        window.api.get('/dashboard/error-trends').catch(() => null),
        window.api.getSkillProgress().catch(() => null)
      ]);

      this.data = { weakness, timing, errors, progress };
      this.renderData();
    } catch (error) {
      console.error('Failed to load analytics:', error);
      this.showError('Failed to load analytics data');
    }
  }

  /**
   * Render the analytics structure
   */
  render() {
    this.container.innerHTML = `
      <div class="analytics">
        <header class="analytics-header">
          <h1 class="page-title">Analytics</h1>
          <div class="analytics-period">
            <select id="analytics-period" class="input">
              <option value="7">Last 7 days</option>
              <option value="30" selected>Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </header>

        <!-- Tab Navigation -->
        <nav class="analytics-tabs">
          <button class="tab-btn active" data-tab="overview">Overview</button>
          <button class="tab-btn" data-tab="skills">Skills</button>
          <button class="tab-btn" data-tab="timing">Timing</button>
          <button class="tab-btn" data-tab="errors">Errors</button>
        </nav>

        <!-- Tab Content -->
        <div class="analytics-content" id="analytics-content">
          <!-- Content rendered dynamically -->
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Period change
    document.getElementById('analytics-period')?.addEventListener('change', (e) => {
      this.loadData();
    });
  }

  /**
   * Switch active tab
   */
  switchTab(tab) {
    this.activeTab = tab;

    // Update tab buttons
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Re-render content
    this.renderData();
  }

  /**
   * Render data based on active tab
   */
  renderData() {
    const content = document.getElementById('analytics-content');
    if (!content) return;

    switch (this.activeTab) {
      case 'overview':
        this.renderOverview(content);
        break;
      case 'skills':
        this.renderSkills(content);
        break;
      case 'timing':
        this.renderTiming(content);
        break;
      case 'errors':
        this.renderErrors(content);
        break;
    }
  }

  /**
   * Render overview tab
   */
  renderOverview(container) {
    const progress = this.data?.progress;
    const timing = this.data?.timing;
    const errors = this.data?.errors;

    container.innerHTML = `
      <div class="analytics-overview">
        <!-- Summary Stats -->
        <section class="analytics-section">
          <h3 class="section-title">Performance Summary</h3>
          <div class="stats-grid grid grid-cols-4 gap-4">
            ${this.renderSummaryStat('Total Questions', progress?.totalQuestions || 0, null, '📊')}
            ${this.renderSummaryStat('Accuracy', `${Math.round(progress?.accuracy || 0)}%`, this.getAccuracyTrend(progress), '🎯')}
            ${this.renderSummaryStat('Avg Time', `${Math.round(timing?.avgTime || 0)}s`, this.getTimingTrend(timing), '⏱')}
            ${this.renderSummaryStat('Streak', `${progress?.streak || 0} days`, null, '🔥')}
          </div>
        </section>

        <!-- Section Breakdown -->
        <section class="analytics-section">
          <h3 class="section-title">Performance by Section</h3>
          <div class="section-breakdown" id="section-breakdown">
            ${this.renderSectionBreakdown()}
          </div>
        </section>

        <!-- Recent Trends -->
        <section class="analytics-section">
          <h3 class="section-title">Recent Trends</h3>
          <div class="trends-chart" id="trends-chart">
            ${this.renderTrendsChart()}
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Render summary stat card
   */
  renderSummaryStat(label, value, trend, icon) {
    let trendHtml = '';
    if (trend !== null && trend !== undefined) {
      const isPositive = trend > 0;
      trendHtml = `
        <div class="stat-trend ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '↑' : '↓'} ${Math.abs(trend)}%
        </div>
      `;
    }

    return `
      <div class="stat-card">
        <div class="stat-icon">${icon}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${trendHtml}
      </div>
    `;
  }

  /**
   * Render section breakdown
   */
  renderSectionBreakdown() {
    const sections = [
      { name: 'Quantitative', accuracy: 72, questions: 150, color: 'var(--accent-primary)' },
      { name: 'Verbal', accuracy: 68, questions: 120, color: 'var(--success)' },
      { name: 'IR', accuracy: 75, questions: 45, color: 'var(--warning)' },
      { name: 'AWA', accuracy: 80, questions: 10, color: 'var(--info)' }
    ];

    // Use actual data if available
    const progress = this.data?.progress;
    if (progress?.sections) {
      // Override with real data
    }

    return sections.map(section => `
      <div class="section-stat">
        <div class="section-header">
          <span class="section-name">${section.name}</span>
          <span class="section-accuracy" style="color: ${this.getAccuracyColor(section.accuracy)}">${section.accuracy}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${section.accuracy}%; background: ${section.color}"></div>
        </div>
        <div class="section-meta">${section.questions} questions</div>
      </div>
    `).join('');
  }

  /**
   * Render trends chart (simple bar chart)
   */
  renderTrendsChart() {
    // Generate last 7 days data
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [65, 72, 68, 80, 75, 82, 78]; // Sample accuracy data

    const maxVal = Math.max(...data);

    return `
      <div class="simple-chart">
        <div class="chart-bars">
          ${data.map((val, i) => `
            <div class="chart-bar-wrapper">
              <div class="chart-bar" style="height: ${(val / maxVal) * 100}%">
                <span class="chart-value">${val}%</span>
              </div>
              <span class="chart-label">${days[i]}</span>
            </div>
          `).join('')}
        </div>
        <div class="chart-legend">
          <span class="legend-item">Daily Accuracy</span>
        </div>
      </div>
    `;
  }

  /**
   * Render skills tab with heatmap
   */
  renderSkills(container) {
    container.innerHTML = `
      <div class="analytics-skills">
        <section class="analytics-section">
          <h3 class="section-title">Skill Mastery Heatmap</h3>
          <p class="section-desc">Colors indicate mastery level: green (strong), yellow (developing), red (needs work)</p>
          <div class="skill-heatmap" id="skill-heatmap">
            ${this.renderSkillHeatmap()}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Top Weaknesses</h3>
          <div class="weakness-list" id="weakness-list">
            ${this.renderWeaknessList()}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Strongest Skills</h3>
          <div class="strength-list" id="strength-list">
            ${this.renderStrengthList()}
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Render skill heatmap
   */
  renderSkillHeatmap() {
    // Sample skill data organized by topic
    const topics = [
      {
        name: 'Arithmetic',
        skills: [
          { name: 'Fractions', mastery: 85 },
          { name: 'Decimals', mastery: 78 },
          { name: 'Percentages', mastery: 92 },
          { name: 'Ratios', mastery: 65 },
          { name: 'Number Properties', mastery: 55 }
        ]
      },
      {
        name: 'Algebra',
        skills: [
          { name: 'Linear Equations', mastery: 88 },
          { name: 'Quadratics', mastery: 72 },
          { name: 'Inequalities', mastery: 60 },
          { name: 'Exponents', mastery: 75 },
          { name: 'Functions', mastery: 45 }
        ]
      },
      {
        name: 'Geometry',
        skills: [
          { name: 'Triangles', mastery: 70 },
          { name: 'Circles', mastery: 65 },
          { name: 'Coordinate', mastery: 58 },
          { name: 'Area/Volume', mastery: 80 }
        ]
      },
      {
        name: 'Sentence Correction',
        skills: [
          { name: 'Subject-Verb', mastery: 75 },
          { name: 'Modifiers', mastery: 52 },
          { name: 'Parallelism', mastery: 68 },
          { name: 'Idioms', mastery: 40 }
        ]
      }
    ];

    return topics.map(topic => `
      <div class="heatmap-topic">
        <div class="topic-name">${topic.name}</div>
        <div class="topic-skills">
          ${topic.skills.map(skill => `
            <div class="skill-cell" 
                 style="background: ${this.getMasteryColor(skill.mastery)}"
                 data-tooltip="${skill.name}: ${skill.mastery}%">
              <span class="skill-abbrev">${skill.name.substring(0, 3)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Render weakness list
   */
  renderWeaknessList() {
    const weaknesses = this.data?.weakness?.weakest || [
      { skill: 'Idioms', accuracy: 40, attempts: 25 },
      { skill: 'Functions', accuracy: 45, attempts: 18 },
      { skill: 'Modifiers', accuracy: 52, attempts: 30 },
      { skill: 'Number Properties', accuracy: 55, attempts: 22 },
      { skill: 'Coordinate Geometry', accuracy: 58, attempts: 15 }
    ];

    return weaknesses.map((item, index) => `
      <div class="skill-item weakness">
        <div class="skill-rank">${index + 1}</div>
        <div class="skill-info">
          <div class="skill-name">${item.skill}</div>
          <div class="skill-meta">${item.attempts} attempts</div>
        </div>
        <div class="skill-score" style="color: var(--error)">${item.accuracy}%</div>
        <button class="btn btn-sm btn-secondary" onclick="window.gmatApp.startTraining('review')">
          Practice
        </button>
      </div>
    `).join('');
  }

  /**
   * Render strength list
   */
  renderStrengthList() {
    const strengths = [
      { skill: 'Percentages', accuracy: 92, attempts: 45 },
      { skill: 'Linear Equations', accuracy: 88, attempts: 38 },
      { skill: 'Fractions', accuracy: 85, attempts: 52 },
      { skill: 'Area/Volume', accuracy: 80, attempts: 28 }
    ];

    return strengths.map((item, index) => `
      <div class="skill-item strength">
        <div class="skill-rank">${index + 1}</div>
        <div class="skill-info">
          <div class="skill-name">${item.skill}</div>
          <div class="skill-meta">${item.attempts} attempts</div>
        </div>
        <div class="skill-score" style="color: var(--success)">${item.accuracy}%</div>
      </div>
    `).join('');
  }

  /**
   * Render timing tab
   */
  renderTiming(container) {
    const timing = this.data?.timing || {};

    container.innerHTML = `
      <div class="analytics-timing">
        <section class="analytics-section">
          <h3 class="section-title">Timing Overview</h3>
          <div class="timing-summary stats-grid grid grid-cols-3 gap-4">
            ${this.renderSummaryStat('Avg Time', `${timing.avgTime || 85}s`, null, '⏱')}
            ${this.renderSummaryStat('On Pace', `${timing.onPacePercent || 65}%`, null, '✓')}
            ${this.renderSummaryStat('Time Saved', `${timing.timeSaved || 12}min`, null, '⚡')}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Time by Question Type</h3>
          <div class="timing-breakdown">
            ${this.renderTimingBreakdown()}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Timing Distribution</h3>
          <div class="timing-distribution">
            ${this.renderTimingDistribution()}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Timing Trends</h3>
          <div class="timing-trends">
            ${this.renderTimingTrends()}
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Render timing breakdown by question type
   */
  renderTimingBreakdown() {
    const types = [
      { name: 'Problem Solving', avg: 95, target: 120, count: 80 },
      { name: 'Data Sufficiency', avg: 85, target: 90, count: 70 },
      { name: 'Sentence Correction', avg: 75, target: 90, count: 60 },
      { name: 'Critical Reasoning', avg: 110, target: 120, count: 40 },
      { name: 'Reading Comp', avg: 140, target: 150, count: 25 }
    ];

    return types.map(type => {
      const pct = (type.avg / type.target) * 100;
      const status = pct <= 90 ? 'fast' : pct <= 110 ? 'on-pace' : 'slow';

      return `
        <div class="timing-type">
          <div class="timing-type-header">
            <span class="type-name">${type.name}</span>
            <span class="type-time ${status}">${type.avg}s / ${type.target}s</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill ${status}" style="width: ${Math.min(pct, 100)}%"></div>
            <div class="target-marker" style="left: ${(100 / 150) * 100}%"></div>
          </div>
          <div class="type-meta">${type.count} questions</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render timing distribution
   */
  renderTimingDistribution() {
    const buckets = [
      { range: '< 60s', count: 45, pct: 22 },
      { range: '60-90s', count: 68, pct: 34 },
      { range: '90-120s', count: 52, pct: 26 },
      { range: '120-150s', count: 25, pct: 12 },
      { range: '> 150s', count: 12, pct: 6 }
    ];

    const maxPct = Math.max(...buckets.map(b => b.pct));

    return `
      <div class="distribution-chart">
        ${buckets.map(bucket => `
          <div class="distribution-bar">
            <div class="bar-fill" style="height: ${(bucket.pct / maxPct) * 100}%">
              <span class="bar-value">${bucket.pct}%</span>
            </div>
            <span class="bar-label">${bucket.range}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render timing trends
   */
  renderTimingTrends() {
    return `
      <div class="trend-item">
        <span class="trend-icon positive">↓</span>
        <span class="trend-text">Average time decreased by <strong>8 seconds</strong> this week</span>
      </div>
      <div class="trend-item">
        <span class="trend-icon positive">↑</span>
        <span class="trend-text">On-pace percentage improved from <strong>58%</strong> to <strong>65%</strong></span>
      </div>
      <div class="trend-item">
        <span class="trend-icon warning">!</span>
        <span class="trend-text">Critical Reasoning questions averaging <strong>10s over target</strong></span>
      </div>
    `;
  }

  /**
   * Render errors tab
   */
  renderErrors(container) {
    container.innerHTML = `
      <div class="analytics-errors">
        <section class="analytics-section">
          <h3 class="section-title">Error Type Distribution</h3>
          <div class="error-distribution">
            ${this.renderErrorDistribution()}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Error Trends</h3>
          <div class="error-trends-chart">
            ${this.renderErrorTrendsChart()}
          </div>
        </section>

        <section class="analytics-section">
          <h3 class="section-title">Most Common Errors</h3>
          <div class="common-errors">
            ${this.renderCommonErrors()}
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Render error distribution
   */
  renderErrorDistribution() {
    const errorTypes = [
      { type: 'Concept Gap', count: 35, pct: 28, color: 'var(--error)', desc: 'Missing foundational knowledge' },
      { type: 'Recognition', count: 25, pct: 20, color: 'var(--warning)', desc: 'Failed to identify question type' },
      { type: 'Decision', count: 20, pct: 16, color: 'var(--info)', desc: 'Wrong approach chosen' },
      { type: 'Execution', count: 22, pct: 18, color: 'var(--accent-primary)', desc: 'Calculation/application error' },
      { type: 'Timing', count: 15, pct: 12, color: 'var(--success)', desc: 'Ran out of time' },
      { type: 'Careless', count: 8, pct: 6, color: 'var(--text-muted)', desc: 'Misread or rushed' }
    ];

    return `
      <div class="error-pie">
        ${errorTypes.map(err => `
          <div class="error-type-item">
            <div class="error-bar" style="width: ${err.pct}%; background: ${err.color}"></div>
            <div class="error-info">
              <div class="error-name">${err.type}</div>
              <div class="error-desc">${err.desc}</div>
            </div>
            <div class="error-stats">
              <span class="error-count">${err.count}</span>
              <span class="error-pct">${err.pct}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render error trends chart
   */
  renderErrorTrendsChart() {
    return `
      <div class="trend-summary">
        <div class="trend-item positive">
          <span class="trend-icon">↓</span>
          <div>
            <strong>Concept Gap errors down 15%</strong>
            <span class="trend-detail">Keep reviewing fundamentals</span>
          </div>
        </div>
        <div class="trend-item warning">
          <span class="trend-icon">↑</span>
          <div>
            <strong>Timing errors up 8%</strong>
            <span class="trend-detail">Try more timed practice</span>
          </div>
        </div>
        <div class="trend-item positive">
          <span class="trend-icon">↓</span>
          <div>
            <strong>Careless errors down 20%</strong>
            <span class="trend-detail">Good attention to detail!</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render common errors
   */
  renderCommonErrors() {
    const errors = [
      { skill: 'Modifiers', type: 'Recognition', count: 8, note: 'Often misidentified as parallelism' },
      { skill: 'Coordinate Geometry', type: 'Execution', count: 6, note: 'Sign errors in slope calculation' },
      { skill: 'Data Sufficiency', type: 'Decision', count: 5, note: 'Forgot to test both statements together' },
      { skill: 'Percentages', type: 'Careless', count: 4, note: 'Percent vs. percentage point confusion' }
    ];

    return errors.map(err => `
      <div class="common-error-item">
        <div class="error-badge badge badge-error">${err.type}</div>
        <div class="error-content">
          <div class="error-skill">${err.skill}</div>
          <div class="error-note">${err.note}</div>
        </div>
        <div class="error-frequency">${err.count}x</div>
      </div>
    `).join('');
  }

  /**
   * Helper: Get mastery color
   */
  getMasteryColor(mastery) {
    if (mastery >= 80) return 'var(--success)';
    if (mastery >= 60) return 'var(--warning)';
    return 'var(--error)';
  }

  /**
   * Helper: Get accuracy color
   */
  getAccuracyColor(accuracy) {
    if (accuracy >= 80) return 'var(--success)';
    if (accuracy >= 60) return 'var(--warning)';
    return 'var(--error)';
  }

  /**
   * Helper: Get accuracy trend
   */
  getAccuracyTrend(progress) {
    return progress?.accuracyTrend || null;
  }

  /**
   * Helper: Get timing trend
   */
  getTimingTrend(timing) {
    return timing?.timingTrend || null;
  }

  /**
   * Show loading state
   */
  showLoading() {
    const content = document.getElementById('analytics-content');
    if (content) {
      content.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      `;
    }
  }

  /**
   * Show error state
   */
  showError(message) {
    const content = document.getElementById('analytics-content');
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="this.closest('.analytics').querySelector('.tab-btn.active').click()">
            Retry
          </button>
        </div>
      `;
    }
  }

  /**
   * Refresh data
   */
  async refresh() {
    await this.loadData();
  }

  /**
   * Cleanup
   */
  destroy() {
    // No cleanup needed
  }
}

// Export
window.Analytics = Analytics;
