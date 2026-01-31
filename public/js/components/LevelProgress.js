/**
 * GMAT Ascension - Level Progress Component
 * Displays level overview, mastery gates, and unlock requirements
 */

class LevelProgress {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.data = null;
    this.expandedLevel = null;
  }

  /**
   * Initialize the view
   */
  async init() {
    this.render();
    await this.loadData();
  }

  /**
   * Load level data
   */
  async loadData() {
    try {
      this.showLoading();

      const [levelProgress, masteryGates, currentLevel] = await Promise.all([
        window.api.getLevelProgress().catch(() => null),
        window.api.getMasteryGates().catch(() => null),
        window.api.get('/user/profile').catch(() => ({ level: 1 }))
      ]);

      this.data = { 
        levels: levelProgress?.levels || this.getDefaultLevels(),
        gates: masteryGates?.gates || [],
        currentLevel: currentLevel?.level || 1
      };
      
      this.renderData();
    } catch (error) {
      console.error('Failed to load level data:', error);
      this.showError('Failed to load level progress');
    }
  }

  /**
   * Render the view structure
   */
  render() {
    this.container.innerHTML = `
      <div class="levels-view">
        <header class="levels-header">
          <h1 class="page-title">Mastery Levels</h1>
          <div class="current-level-badge" id="current-level-badge">
            <!-- Current level badge rendered here -->
          </div>
        </header>

        <div class="levels-content" id="levels-content">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading levels...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render data
   */
  renderData() {
    // Render current level badge
    const badge = document.getElementById('current-level-badge');
    if (badge) {
      badge.innerHTML = `
        <span class="badge-label">Current Level</span>
        <span class="badge-value">${this.data.currentLevel}</span>
        <span class="badge-name">${this.getLevelName(this.data.currentLevel)}</span>
      `;
    }

    // Render levels list
    const content = document.getElementById('levels-content');
    if (content) {
      content.innerHTML = `
        <div class="levels-progress-overview">
          ${this.renderProgressOverview()}
        </div>
        <div class="levels-list">
          ${this.renderLevelsList()}
        </div>
      `;
    }

    this.setupEventListeners();
  }

  /**
   * Render progress overview
   */
  renderProgressOverview() {
    const current = this.data.currentLevel;
    const total = 10; // Total levels
    const progress = (current / total) * 100;

    return `
      <div class="progress-overview">
        <div class="progress-stats">
          <div class="progress-stat">
            <span class="stat-value">${current}</span>
            <span class="stat-label">Current Level</span>
          </div>
          <div class="progress-stat">
            <span class="stat-value">${total - current}</span>
            <span class="stat-label">Levels Remaining</span>
          </div>
          <div class="progress-stat">
            <span class="stat-value">${Math.round(progress)}%</span>
            <span class="stat-label">Overall Progress</span>
          </div>
        </div>
        <div class="progress-bar large">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render levels list
   */
  renderLevelsList() {
    return this.data.levels.map(level => {
      const status = this.getLevelStatus(level.number);
      const isExpanded = this.expandedLevel === level.number;
      
      return `
        <div class="level-card ${status}" data-level="${level.number}">
          <div class="level-header" onclick="window.levelsView?.toggleLevel(${level.number})">
            <div class="level-icon">${this.getLevelIcon(level.number, status)}</div>
            <div class="level-info">
              <div class="level-number">Level ${level.number}</div>
              <div class="level-name">${level.name}</div>
            </div>
            <div class="level-status">
              ${this.renderLevelStatusBadge(status)}
            </div>
            <div class="level-expand">
              ${isExpanded ? '▼' : '▶'}
            </div>
          </div>
          
          ${isExpanded ? this.renderLevelDetails(level) : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Render level details
   */
  renderLevelDetails(level) {
    const gates = this.data.gates.filter(g => g.levelNumber === level.number);
    
    return `
      <div class="level-details">
        <div class="level-description">
          <p>${level.description}</p>
        </div>
        
        ${gates.length > 0 ? `
          <div class="mastery-gates">
            <h4 class="gates-title">Mastery Requirements</h4>
            <div class="gates-list">
              ${gates.map(gate => this.renderGate(gate)).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="level-skills">
          <h4 class="skills-title">Skills Unlocked</h4>
          <div class="skills-list">
            ${this.renderSkillsList(level.skills || [])}
          </div>
        </div>
        
        ${level.number === this.data.currentLevel ? `
          <div class="level-actions">
            <button class="btn btn-primary" onclick="window.gmatApp.startTraining('mixed')">
              Continue Training
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render a mastery gate
   */
  renderGate(gate) {
    const progress = gate.progress || 0;
    const isComplete = progress >= 100;
    
    return `
      <div class="gate-item ${isComplete ? 'complete' : ''}">
        <div class="gate-icon">${isComplete ? '✓' : '○'}</div>
        <div class="gate-info">
          <div class="gate-description">${gate.description}</div>
          <div class="gate-progress-bar">
            <div class="progress-bar">
              <div class="progress-bar-fill ${isComplete ? 'success' : ''}" 
                   style="width: ${progress}%"></div>
            </div>
            <span class="gate-progress-text">${Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render skills list
   */
  renderSkillsList(skills) {
    if (!skills || skills.length === 0) {
      return '<p class="text-muted">Skills for this level not yet defined</p>';
    }

    return skills.map(skill => `
      <div class="skill-badge">
        <span class="skill-icon">📚</span>
        <span class="skill-name">${skill}</span>
      </div>
    `).join('');
  }

  /**
   * Render level status badge
   */
  renderLevelStatusBadge(status) {
    const badges = {
      completed: '<span class="badge badge-success">Completed</span>',
      active: '<span class="badge badge-primary">Active</span>',
      locked: '<span class="badge badge-default">Locked</span>'
    };
    return badges[status] || badges.locked;
  }

  /**
   * Get level status
   */
  getLevelStatus(levelNumber) {
    if (levelNumber < this.data.currentLevel) return 'completed';
    if (levelNumber === this.data.currentLevel) return 'active';
    return 'locked';
  }

  /**
   * Get level icon
   */
  getLevelIcon(levelNumber, status) {
    if (status === 'completed') return '✓';
    if (status === 'locked') return '🔒';
    
    const icons = ['🌱', '🌿', '🌳', '⭐', '🌟', '💫', '🏆', '👑', '💎', '🎓'];
    return icons[levelNumber - 1] || '📚';
  }

  /**
   * Get level name
   */
  getLevelName(levelNumber) {
    const names = [
      'Orientation',
      'Foundation',
      'Fundamentals',
      'Core Skills',
      'Intermediate',
      'Advanced',
      'Expert',
      'Master',
      'Elite',
      'GMAT Ready'
    ];
    return names[levelNumber - 1] || `Level ${levelNumber}`;
  }

  /**
   * Get default levels data
   */
  getDefaultLevels() {
    return [
      {
        number: 1,
        name: 'Orientation',
        description: 'Learn the GMAT structure, question types, and basic strategies.',
        skills: ['Test Overview', 'Time Management', 'Question Recognition']
      },
      {
        number: 2,
        name: 'Foundation',
        description: 'Build fundamental skills in arithmetic, grammar basics, and critical thinking.',
        skills: ['Arithmetic', 'Basic Grammar', 'Argument Structure']
      },
      {
        number: 3,
        name: 'Fundamentals',
        description: 'Strengthen core concepts in algebra, sentence structure, and reasoning patterns.',
        skills: ['Algebra Basics', 'Sentence Correction', 'Strengthening/Weakening']
      },
      {
        number: 4,
        name: 'Core Skills',
        description: 'Develop proficiency in geometry, verbal idioms, and inference questions.',
        skills: ['Geometry', 'Idioms & Usage', 'Inference']
      },
      {
        number: 5,
        name: 'Intermediate',
        description: 'Apply knowledge to medium-difficulty questions with increased time pressure.',
        skills: ['Word Problems', 'Modifier Errors', 'Assumption Questions']
      },
      {
        number: 6,
        name: 'Advanced',
        description: 'Tackle complex problems requiring multiple skill combinations.',
        skills: ['Data Sufficiency', 'Parallelism', 'Evaluate Questions']
      },
      {
        number: 7,
        name: 'Expert',
        description: 'Handle high-difficulty questions with sophisticated traps.',
        skills: ['Number Properties', 'Comparison Errors', 'Bold-faced CR']
      },
      {
        number: 8,
        name: 'Master',
        description: 'Demonstrate consistent accuracy under strict time limits.',
        skills: ['Coordinate Geometry', 'Complex SC', 'Multi-source Reasoning']
      },
      {
        number: 9,
        name: 'Elite',
        description: 'Achieve near-perfect accuracy on the hardest questions.',
        skills: ['Combinatorics', 'Inference in RC', 'IR Synthesis']
      },
      {
        number: 10,
        name: 'GMAT Ready',
        description: 'Ready for test day with proven performance across all areas.',
        skills: ['Full Test Simulation', 'Endurance Training', 'Score Prediction']
      }
    ];
  }

  /**
   * Toggle level expansion
   */
  toggleLevel(levelNumber) {
    this.expandedLevel = this.expandedLevel === levelNumber ? null : levelNumber;
    this.renderData();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Store reference for onclick handlers
    window.levelsView = this;
  }

  /**
   * Show loading state
   */
  showLoading() {
    const content = document.getElementById('levels-content');
    if (content) {
      content.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading levels...</p>
        </div>
      `;
    }
  }

  /**
   * Show error state
   */
  showError(message) {
    const content = document.getElementById('levels-content');
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="window.levelsView?.loadData()">
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
    delete window.levelsView;
  }
}

// Export
window.LevelProgress = LevelProgress;
