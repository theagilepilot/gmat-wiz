/**
 * GMAT Ascension - Daily Plan Component
 * Shows today's recommended practice plan
 */

class DailyPlan {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.plan = null;
    
    this.render();
  }

  /**
   * Render the component
   */
  render() {
    this.container.innerHTML = `
      <div class="daily-plan">
        <div class="plan-summary">
          <div class="plan-progress-ring" id="plan-progress"></div>
          <div class="plan-info">
            <div class="plan-completed">
              <span id="plan-done">0</span> / <span id="plan-total">0</span>
            </div>
            <div class="plan-label">questions today</div>
          </div>
        </div>
        <div class="plan-tasks" id="plan-tasks"></div>
      </div>
    `;
  }

  /**
   * Update with plan data
   * @param {Object} plan - Daily plan data
   * @param {number} plan.targetQuestions - Target for today
   * @param {number} plan.completedQuestions - Questions done
   * @param {Array} plan.tasks - List of tasks
   */
  update(plan) {
    if (!plan) return;
    this.plan = plan;

    const done = plan.completedQuestions || 0;
    const total = plan.targetQuestions || 30;
    const progress = Math.min((done / total) * 100, 100);

    // Update counts
    document.getElementById('plan-done').textContent = done;
    document.getElementById('plan-total').textContent = total;

    // Update progress ring
    const progressContainer = document.getElementById('plan-progress');
    progressContainer.innerHTML = this.renderProgressRing(progress);

    // Update tasks
    this.renderTasks(plan.tasks || []);
  }

  /**
   * Render mini progress ring
   */
  renderProgressRing(progress) {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    let color = 'var(--accent-primary)';
    if (progress >= 100) color = 'var(--success)';
    else if (progress >= 75) color = 'var(--warning)';

    return `
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r="${radius}"
          fill="none"
          stroke="var(--bg-tertiary)"
          stroke-width="4"
        />
        <circle
          cx="25"
          cy="25"
          r="${radius}"
          fill="none"
          stroke="${color}"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 25 25)"
          style="transition: stroke-dashoffset 0.5s ease"
        />
      </svg>
    `;
  }

  /**
   * Render task list
   */
  renderTasks(tasks) {
    const container = document.getElementById('plan-tasks');

    if (!tasks || tasks.length === 0) {
      // Generate default tasks if none provided
      tasks = this.generateDefaultTasks();
    }

    container.innerHTML = tasks.map(task => `
      <div class="plan-task ${task.completed ? 'completed' : ''} ${task.current ? 'current' : ''}">
        <div class="task-status">
          ${task.completed ? '✓' : task.current ? '→' : '○'}
        </div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-detail">${task.detail || ''}</div>
        </div>
        ${task.count ? `<div class="task-count">${task.count}</div>` : ''}
      </div>
    `).join('');
  }

  /**
   * Generate default tasks
   */
  generateDefaultTasks() {
    const done = this.plan?.completedQuestions || 0;
    
    return [
      {
        title: 'Warm-up Sprint',
        detail: '10 quick questions',
        completed: done >= 10,
        current: done < 10,
        count: done >= 10 ? '✓' : `${Math.min(done, 10)}/10`
      },
      {
        title: 'Skill Focus',
        detail: 'Work on weak areas',
        completed: done >= 25,
        current: done >= 10 && done < 25,
        count: done >= 25 ? '✓' : `${Math.max(0, Math.min(done - 10, 15))}/15`
      },
      {
        title: 'Review',
        detail: 'Revisit missed questions',
        completed: done >= 30,
        current: done >= 25 && done < 30,
        count: done >= 30 ? '✓' : `${Math.max(0, done - 25)}/5`
      }
    ];
  }

  /**
   * Check if today's goal is complete
   */
  isComplete() {
    if (!this.plan) return false;
    return (this.plan.completedQuestions || 0) >= (this.plan.targetQuestions || 30);
  }
}

// Export
window.DailyPlan = DailyPlan;
