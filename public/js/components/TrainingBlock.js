/**
 * GMAT Ascension - Training Block Component
 * Manages a training session block
 */

class TrainingBlock {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.block = null;
    this.currentQuestion = null;
    this.questionIndex = 0;
    
    // Callbacks
    this.onComplete = null;
    this.onAbandon = null;
  }

  /**
   * Initialize with block data
   * @param {Object} block - Training block data
   */
  async init(block) {
    this.block = block;
    this.questionIndex = block.completedQuestions || 0;
    
    this.render();
    await this.loadNextQuestion();
    
    // Register keyboard shortcuts
    window.keyboard.setContext('training');
    window.keyboard.register('escape', () => this.handleAbandon(), {
      context: 'training',
      description: 'Abandon block'
    });
  }

  /**
   * Render the block view
   */
  render() {
    const mode = this.block.mode || 'mixed';
    const modeInfo = this.getModeInfo(mode);

    this.container.innerHTML = `
      <div class="training-block">
        <!-- Block Header -->
        <header class="block-header">
          <div class="block-mode" style="--mode-color: ${modeInfo.color}">
            <span class="mode-icon">${modeInfo.icon}</span>
            <span class="mode-name">${modeInfo.name}</span>
          </div>
          <div class="block-progress">
            <div class="progress-text">
              <span id="block-current">${this.questionIndex}</span>
              <span class="progress-sep">/</span>
              <span id="block-total">${this.block.targetQuestions}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar-fill" id="block-progress-fill" style="width: 0%"></div>
            </div>
          </div>
          <button class="icon-btn" id="block-menu-btn" title="Options">
            ⋮
          </button>
        </header>

        <!-- Question Container -->
        <div class="block-content" id="question-container">
          <div class="loading-state">
            <div class="spinner"></div>
            <div class="loading-text">Loading question...</div>
          </div>
        </div>

        <!-- Block Footer -->
        <footer class="block-footer">
          <div class="block-stats">
            <div class="block-stat">
              <span class="stat-icon">✓</span>
              <span id="block-correct">0</span> correct
            </div>
            <div class="block-stat">
              <span class="stat-icon">⏱</span>
              <span id="block-time">0:00</span>
            </div>
          </div>
          <button class="btn btn-ghost" id="abandon-btn">
            End Session
          </button>
        </footer>
      </div>
    `;

    this.updateProgress();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    const abandonBtn = document.getElementById('abandon-btn');
    if (abandonBtn) {
      abandonBtn.addEventListener('click', () => this.handleAbandon());
    }

    const menuBtn = document.getElementById('block-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => this.showBlockMenu());
    }
  }

  /**
   * Load next question
   */
  async loadNextQuestion() {
    const container = document.getElementById('question-container');
    
    try {
      container.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <div class="loading-text">Loading question...</div>
        </div>
      `;

      const question = await window.api.getNextQuestion(this.block.id);
      
      if (!question) {
        // Block is complete
        this.handleComplete();
        return;
      }

      this.currentQuestion = question;
      this.renderQuestion(question);

    } catch (error) {
      console.error('Failed to load question:', error);
      container.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <div class="error-message">Failed to load question</div>
          <button class="btn btn-primary" onclick="this.closest('.training-block').dispatchEvent(new CustomEvent('retry'))">
            Try Again
          </button>
        </div>
      `;
    }
  }

  /**
   * Render question
   */
  renderQuestion(question) {
    const container = document.getElementById('question-container');
    
    // Create Question component
    const questionComponent = new Question(container, {
      question,
      onSubmit: (answer, timeSpent) => this.handleAnswer(answer, timeSpent),
      onNext: () => this.loadNextQuestion()
    });

    questionComponent.render();
  }

  /**
   * Handle answer submission
   */
  async handleAnswer(answer, timeSpent) {
    try {
      const result = await window.api.submitAnswer({
        questionId: this.currentQuestion.id,
        answer,
        timeSpent,
        blockId: this.block.id
      });

      // Update stats
      this.questionIndex++;
      if (result.isCorrect) {
        this.block.correctCount = (this.block.correctCount || 0) + 1;
      }

      this.updateProgress();
      this.updateStats();

      return result;
    } catch (error) {
      console.error('Failed to submit answer:', error);
      throw error;
    }
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    const current = document.getElementById('block-current');
    const fill = document.getElementById('block-progress-fill');
    
    if (current) current.textContent = this.questionIndex;
    
    if (fill) {
      const progress = (this.questionIndex / this.block.targetQuestions) * 100;
      fill.style.width = `${Math.min(progress, 100)}%`;
    }
  }

  /**
   * Update block stats
   */
  updateStats() {
    const correctEl = document.getElementById('block-correct');
    if (correctEl) {
      correctEl.textContent = this.block.correctCount || 0;
    }
  }

  /**
   * Handle block completion
   */
  async handleComplete() {
    try {
      await window.api.completeBlock(this.block.id);
      
      if (this.onComplete) {
        this.onComplete(this.block);
      }

      // Show completion UI
      this.showCompletionScreen();
    } catch (error) {
      console.error('Failed to complete block:', error);
    }
  }

  /**
   * Handle block abandonment
   */
  async handleAbandon() {
    const confirmed = confirm('Are you sure you want to end this session? Progress will be saved.');
    
    if (!confirmed) return;

    try {
      await window.api.abandonBlock(this.block.id);
      
      if (this.onAbandon) {
        this.onAbandon(this.block);
      }

      // Navigate back to dashboard
      if (window.gmatApp && window.gmatApp.showView) {
        window.gmatApp.showView('dashboard-view');
      }
    } catch (error) {
      console.error('Failed to abandon block:', error);
    }
  }

  /**
   * Show block menu
   */
  showBlockMenu() {
    // Could show a dropdown menu with options
    console.log('Block menu clicked');
  }

  /**
   * Show completion screen
   */
  showCompletionScreen() {
    const accuracy = this.block.correctCount / this.questionIndex * 100;
    
    this.container.innerHTML = `
      <div class="block-complete">
        <div class="complete-icon">🎉</div>
        <h2 class="complete-title">Block Complete!</h2>
        
        <div class="complete-stats">
          <div class="complete-stat">
            <div class="stat-value">${this.questionIndex}</div>
            <div class="stat-label">Questions</div>
          </div>
          <div class="complete-stat">
            <div class="stat-value ${accuracy >= 70 ? 'success' : ''}">${Math.round(accuracy)}%</div>
            <div class="stat-label">Accuracy</div>
          </div>
          <div class="complete-stat">
            <div class="stat-value">${this.block.correctCount || 0}</div>
            <div class="stat-label">Correct</div>
          </div>
        </div>

        <div class="complete-actions">
          <button class="btn btn-primary btn-large" id="continue-btn">
            Continue Training
          </button>
          <button class="btn btn-secondary" id="dashboard-btn">
            Back to Dashboard
          </button>
        </div>
      </div>
    `;

    document.getElementById('continue-btn')?.addEventListener('click', () => {
      // Start new block with same mode
      if (window.gmatApp && window.gmatApp.startTraining) {
        window.gmatApp.startTraining(this.block.mode);
      }
    });

    document.getElementById('dashboard-btn')?.addEventListener('click', () => {
      if (window.gmatApp && window.gmatApp.showView) {
        window.gmatApp.showView('dashboard-view');
      }
    });
  }

  /**
   * Get mode info
   */
  getModeInfo(mode) {
    const modes = {
      sprint: { name: 'Sprint', icon: '⚡', color: 'var(--mode-sprint)' },
      endurance: { name: 'Endurance', icon: '🎯', color: 'var(--mode-endurance)' },
      review: { name: 'Review', icon: '📚', color: 'var(--mode-review)' },
      mixed: { name: 'Mixed', icon: '🔀', color: 'var(--mode-mixed)' }
    };
    return modes[mode] || modes.mixed;
  }

  /**
   * Cleanup
   */
  destroy() {
    window.keyboard.unregister('escape', 'training');
  }
}

// Export
window.TrainingBlock = TrainingBlock;
