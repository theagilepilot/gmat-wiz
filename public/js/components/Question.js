/**
 * GMAT Ascension - Question Component
 * Displays a question with choices and handles user interaction
 */

class Question {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.question = options.question;
    this.onSubmit = options.onSubmit || (() => {});
    this.onNext = options.onNext || (() => {});
    
    this.selectedAnswer = null;
    this.submitted = false;
    this.result = null;
    this.startTime = null;
    
    // Choice navigator for keyboard nav
    this.navigator = new ChoiceNavigator({
      onSelect: (index) => {
        this.selectedAnswer = String.fromCharCode(65 + index);
      }
    });
  }

  /**
   * Render the question
   */
  render() {
    this.startTime = Date.now();
    
    const q = this.question;
    const difficultyClass = this.getDifficultyClass(q.difficulty);

    this.container.innerHTML = `
      <div class="question animate-fade-in">
        <!-- Question Header -->
        <div class="question-header">
          <div class="question-meta">
            <span class="badge badge-${difficultyClass}">${q.difficulty || 'Medium'}</span>
            <span class="badge badge-default">${q.skill || 'General'}</span>
            ${q.subskill ? `<span class="badge badge-default">${q.subskill}</span>` : ''}
          </div>
          <div class="question-timer" id="question-timer">
            <span class="timer-icon">⏱</span>
            <span class="timer-value">0:00</span>
          </div>
        </div>

        <!-- Question Stem -->
        <div class="question-stem">
          ${this.formatStem(q.stem)}
        </div>

        <!-- Choices -->
        <div class="choice-list" id="choice-list">
          ${this.renderChoices(q.choices)}
        </div>

        <!-- Submit Bar -->
        <div class="submit-bar">
          <div class="kbd-hints">
            <span class="kbd-hint"><kbd>A</kbd>-<kbd>E</kbd> Select</span>
            <span class="kbd-hint"><kbd>Enter</kbd> Submit</span>
          </div>
          <button class="btn btn-primary btn-large" id="submit-btn" disabled>
            Submit Answer
          </button>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.startTimer();
    this.registerKeyboardShortcuts();
  }

  /**
   * Format the question stem (handle markdown-like formatting)
   */
  formatStem(stem) {
    if (!stem) return '';
    
    // Basic formatting: bold, italic, code
    return stem
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Render answer choices
   */
  renderChoices(choices) {
    if (!choices || !Array.isArray(choices)) return '';

    return choices.map((choice, index) => {
      const letter = String.fromCharCode(65 + index);
      return `
        <div class="choice" data-answer="${letter}" tabindex="0">
          <div class="choice-letter">${letter}</div>
          <div class="choice-text">${this.formatStem(choice)}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Choice click handlers
    const choices = this.container.querySelectorAll('.choice');
    choices.forEach(choice => {
      choice.addEventListener('click', () => {
        if (this.submitted) return;
        this.selectChoice(choice.dataset.answer);
      });
    });

    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submit());
    }
  }

  /**
   * Register keyboard shortcuts
   */
  registerKeyboardShortcuts() {
    const shortcuts = ['a', 'b', 'c', 'd', 'e'];
    
    shortcuts.forEach((key, index) => {
      window.keyboard.register(key, () => {
        if (this.submitted) return;
        const choices = this.question.choices || [];
        if (index < choices.length) {
          this.navigator.selectByIndex(index);
          this.selectChoice(String.fromCharCode(65 + index));
        }
      }, {
        context: 'question',
        description: `Select answer ${key.toUpperCase()}`
      });
    });

    window.keyboard.register('enter', () => {
      if (this.submitted) {
        this.onNext();
      } else if (this.selectedAnswer) {
        this.submit();
      }
    }, {
      context: 'question',
      description: 'Submit answer'
    });

    window.keyboard.register('up', () => {
      if (!this.submitted) this.navigator.moveUp();
    }, {
      context: 'question',
      description: 'Previous choice'
    });

    window.keyboard.register('down', () => {
      if (!this.submitted) this.navigator.moveDown();
    }, {
      context: 'question',
      description: 'Next choice'
    });

    window.keyboard.setContext('question');
  }

  /**
   * Select a choice
   */
  selectChoice(answer) {
    if (this.submitted) return;

    this.selectedAnswer = answer;

    // Update UI
    const choices = this.container.querySelectorAll('.choice');
    choices.forEach(choice => {
      choice.classList.remove('selected');
      if (choice.dataset.answer === answer) {
        choice.classList.add('selected');
      }
    });

    // Enable submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }

  /**
   * Submit the answer
   */
  async submit() {
    if (this.submitted || !this.selectedAnswer) return;

    this.submitted = true;
    this.stopTimer();

    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    const submitBtn = document.getElementById('submit-btn');
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Checking...';
    }

    try {
      this.result = await this.onSubmit(this.selectedAnswer, timeSpent);
      this.showResult();
    } catch (error) {
      console.error('Failed to submit:', error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Answer';
      this.submitted = false;
    }
  }

  /**
   * Show the result
   */
  showResult() {
    const isCorrect = this.result?.isCorrect;
    const correctAnswer = this.result?.correctAnswer || this.question.correctAnswer;

    // Update choices to show correct/incorrect
    const choices = this.container.querySelectorAll('.choice');
    choices.forEach(choice => {
      const answer = choice.dataset.answer;
      
      if (answer === correctAnswer) {
        choice.classList.add('correct');
        choice.querySelector('.choice-letter').innerHTML = '✓';
      } else if (answer === this.selectedAnswer && !isCorrect) {
        choice.classList.add('incorrect');
        choice.querySelector('.choice-letter').innerHTML = '✗';
      }
    });

    // Update submit bar
    const submitBar = this.container.querySelector('.submit-bar');
    if (submitBar) {
      submitBar.innerHTML = `
        <div class="result-feedback ${isCorrect ? 'correct' : 'incorrect'}">
          <span class="result-icon">${isCorrect ? '✓' : '✗'}</span>
          <span class="result-text">${isCorrect ? 'Correct!' : 'Incorrect'}</span>
          ${this.result?.eloChange ? `
            <span class="elo-change ${this.result.eloChange > 0 ? 'positive' : 'negative'}">
              ${this.result.eloChange > 0 ? '+' : ''}${Math.round(this.result.eloChange)} ELO
            </span>
          ` : ''}
        </div>
        <button class="btn btn-primary" id="next-btn">
          Next Question <kbd>Enter</kbd>
        </button>
      `;

      document.getElementById('next-btn')?.addEventListener('click', () => this.onNext());
    }

    // Show explanation if available
    if (this.result?.explanation || this.question.explanation) {
      this.showExplanation(this.result?.explanation || this.question.explanation);
    }
  }

  /**
   * Show explanation
   */
  showExplanation(explanation) {
    const explanationHtml = `
      <div class="explanation animate-slide-up">
        <div class="explanation-header">
          <span class="explanation-icon">💡</span>
          <span class="explanation-title">Explanation</span>
        </div>
        <div class="explanation-content">
          ${this.formatStem(explanation)}
        </div>
      </div>
    `;

    const submitBar = this.container.querySelector('.submit-bar');
    if (submitBar) {
      submitBar.insertAdjacentHTML('beforebegin', explanationHtml);
    }
  }

  /**
   * Start the timer
   */
  startTimer() {
    const timerEl = this.container.querySelector('.timer-value');
    if (!timerEl) return;

    this.timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Visual warning after 2 minutes
      if (elapsed > 120) {
        timerEl.parentElement.classList.add('warning');
      }
    }, 1000);
  }

  /**
   * Stop the timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Get difficulty class
   */
  getDifficultyClass(difficulty) {
    const map = {
      easy: 'easy',
      medium: 'medium',
      hard: 'hard',
      stretch: 'stretch'
    };
    return map[difficulty?.toLowerCase()] || 'medium';
  }

  /**
   * Get time spent
   */
  getTimeSpent() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopTimer();
    
    // Unregister keyboard shortcuts
    ['a', 'b', 'c', 'd', 'e', 'enter', 'up', 'down'].forEach(key => {
      window.keyboard.unregister(key, 'question');
    });
  }
}

// Export
window.Question = Question;
