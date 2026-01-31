/**
 * GMAT Ascension - Error Log Component
 * Searchable error history with filters
 */

export class ErrorLog {
  constructor(container, api) {
    this.container = container;
    this.api = api;
    this.errors = [];
    this.filteredErrors = [];
    this.filters = {
      section: 'all',
      errorType: 'all',
      skill: 'all',
      dateRange: 'all',
      search: ''
    };
    this.sortBy = 'date';
    this.sortOrder = 'desc';
    this.page = 1;
    this.pageSize = 20;
    this.keyboardHandler = this.handleKeyboard.bind(this);
  }

  async init() {
    this.render();
    await this.loadData();
    this.attachEventListeners();
    document.addEventListener('keydown', this.keyboardHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.keyboardHandler);
  }

  async loadData() {
    try {
      // Fetch error history from API
      const response = await this.api.getErrorHistory();
      this.errors = response.errors || this.getMockErrors();
      this.applyFilters();
    } catch (error) {
      console.error('Failed to load error data:', error);
      this.errors = this.getMockErrors();
      this.applyFilters();
    }
  }

  getMockErrors() {
    // Mock data for development
    const sections = ['quant', 'verbal', 'di'];
    const skills = ['algebra', 'geometry', 'reading-comp', 'critical-reasoning', 'data-interpretation'];
    const errorTypes = ['conceptual', 'careless', 'time-pressure', 'trap-answer'];
    const mockErrors = [];
    
    for (let i = 0; i < 50; i++) {
      const section = sections[Math.floor(Math.random() * sections.length)];
      const skill = skills[Math.floor(Math.random() * skills.length)];
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      
      mockErrors.push({
        id: i + 1,
        questionId: 1000 + i,
        questionStem: `Sample question ${i + 1} about ${skill.replace('-', ' ')}...`,
        section,
        skill,
        errorType,
        userAnswer: ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)],
        correctAnswer: ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)],
        timeSpent: Math.floor(Math.random() * 180) + 30,
        date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        notes: i % 3 === 0 ? 'Need to review this concept' : ''
      });
    }
    
    return mockErrors;
  }

  render() {
    this.container.innerHTML = `
      <div class="error-log-view">
        <header class="error-log-header">
          <h2>Error Log</h2>
          <div class="error-summary">
            <span class="error-count">Loading...</span>
          </div>
        </header>

        <div class="error-controls">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" 
                   class="search-input" 
                   placeholder="Search errors... (Ctrl+F)"
                   aria-label="Search errors">
            <kbd class="search-shortcut">Ctrl+F</kbd>
          </div>

          <div class="filter-row">
            <div class="filter-group">
              <label class="filter-label">Section</label>
              <select class="filter-select" data-filter="section">
                <option value="all">All Sections</option>
                <option value="quant">Quantitative</option>
                <option value="verbal">Verbal</option>
                <option value="di">Data Insights</option>
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label">Error Type</label>
              <select class="filter-select" data-filter="errorType">
                <option value="all">All Types</option>
                <option value="conceptual">Conceptual</option>
                <option value="careless">Careless</option>
                <option value="time-pressure">Time Pressure</option>
                <option value="trap-answer">Trap Answer</option>
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label">Time Range</label>
              <select class="filter-select" data-filter="dateRange">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label">Sort By</label>
              <select class="filter-select" data-sort="sortBy">
                <option value="date">Date</option>
                <option value="section">Section</option>
                <option value="errorType">Error Type</option>
                <option value="timeSpent">Time Spent</option>
              </select>
            </div>
          </div>

          <div class="active-filters" style="display: none;">
            <span class="filters-label">Active filters:</span>
            <div class="filter-tags"></div>
            <button class="btn btn-text clear-filters">Clear all</button>
          </div>
        </div>

        <div class="error-list-container">
          <div class="error-list">
            <div class="loading-spinner">Loading errors...</div>
          </div>
        </div>

        <div class="pagination">
          <button class="btn btn-secondary pagination-prev" disabled>
            ← Previous
          </button>
          <span class="pagination-info">Page 1 of 1</span>
          <button class="btn btn-secondary pagination-next" disabled>
            Next →
          </button>
        </div>

        <div class="error-detail-modal" style="display: none;">
          <div class="modal-overlay"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Error Details</h3>
              <button class="modal-close" aria-label="Close">×</button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary modal-prev">← Previous</button>
              <button class="btn btn-primary modal-retry">Retry Question</button>
              <button class="btn btn-secondary modal-next">Next →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Search input
    const searchInput = this.container.querySelector('.search-input');
    searchInput?.addEventListener('input', (e) => {
      this.filters.search = e.target.value;
      this.page = 1;
      this.applyFilters();
    });

    // Filter selects
    this.container.querySelectorAll('.filter-select[data-filter]').forEach(select => {
      select.addEventListener('change', (e) => {
        const filterName = e.target.dataset.filter;
        this.filters[filterName] = e.target.value;
        this.page = 1;
        this.applyFilters();
      });
    });

    // Sort select
    const sortSelect = this.container.querySelector('.filter-select[data-sort]');
    sortSelect?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.applyFilters();
    });

    // Clear filters
    const clearBtn = this.container.querySelector('.clear-filters');
    clearBtn?.addEventListener('click', () => this.clearFilters());

    // Pagination
    const prevBtn = this.container.querySelector('.pagination-prev');
    const nextBtn = this.container.querySelector('.pagination-next');
    prevBtn?.addEventListener('click', () => this.changePage(-1));
    nextBtn?.addEventListener('click', () => this.changePage(1));

    // Error list clicks
    const errorList = this.container.querySelector('.error-list');
    errorList?.addEventListener('click', (e) => {
      const errorItem = e.target.closest('.error-item');
      if (errorItem) {
        const errorId = parseInt(errorItem.dataset.errorId);
        this.showErrorDetail(errorId);
      }
    });

    // Modal controls
    const modalClose = this.container.querySelector('.modal-close');
    const modalOverlay = this.container.querySelector('.modal-overlay');
    modalClose?.addEventListener('click', () => this.closeModal());
    modalOverlay?.addEventListener('click', () => this.closeModal());

    const modalPrev = this.container.querySelector('.modal-prev');
    const modalNext = this.container.querySelector('.modal-next');
    modalPrev?.addEventListener('click', () => this.navigateError(-1));
    modalNext?.addEventListener('click', () => this.navigateError(1));

    const modalRetry = this.container.querySelector('.modal-retry');
    modalRetry?.addEventListener('click', () => this.retryQuestion());
  }

  handleKeyboard(e) {
    // Ctrl+F to focus search
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const searchInput = this.container.querySelector('.search-input');
      searchInput?.focus();
    }

    // Escape to close modal
    if (e.key === 'Escape') {
      this.closeModal();
    }

    // Arrow keys for modal navigation
    const modal = this.container.querySelector('.error-detail-modal');
    if (modal?.style.display !== 'none') {
      if (e.key === 'ArrowLeft') {
        this.navigateError(-1);
      } else if (e.key === 'ArrowRight') {
        this.navigateError(1);
      }
    }
  }

  applyFilters() {
    let filtered = [...this.errors];

    // Apply search
    if (this.filters.search) {
      const search = this.filters.search.toLowerCase();
      filtered = filtered.filter(error => 
        error.questionStem.toLowerCase().includes(search) ||
        error.skill.toLowerCase().includes(search) ||
        error.notes?.toLowerCase().includes(search)
      );
    }

    // Apply section filter
    if (this.filters.section !== 'all') {
      filtered = filtered.filter(error => error.section === this.filters.section);
    }

    // Apply error type filter
    if (this.filters.errorType !== 'all') {
      filtered = filtered.filter(error => error.errorType === this.filters.errorType);
    }

    // Apply date range filter
    if (this.filters.dateRange !== 'all') {
      const now = new Date();
      let cutoff;
      switch (this.filters.dateRange) {
        case 'today':
          cutoff = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          cutoff = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          cutoff = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }
      if (cutoff) {
        filtered = filtered.filter(error => new Date(error.date) >= cutoff);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (this.sortBy) {
        case 'date':
          comparison = new Date(b.date) - new Date(a.date);
          break;
        case 'section':
          comparison = a.section.localeCompare(b.section);
          break;
        case 'errorType':
          comparison = a.errorType.localeCompare(b.errorType);
          break;
        case 'timeSpent':
          comparison = b.timeSpent - a.timeSpent;
          break;
      }
      return this.sortOrder === 'desc' ? comparison : -comparison;
    });

    this.filteredErrors = filtered;
    this.renderErrorList();
    this.updateFilterUI();
  }

  renderErrorList() {
    const errorList = this.container.querySelector('.error-list');
    const totalPages = Math.ceil(this.filteredErrors.length / this.pageSize);
    const start = (this.page - 1) * this.pageSize;
    const pageErrors = this.filteredErrors.slice(start, start + this.pageSize);

    // Update summary
    const errorCount = this.container.querySelector('.error-count');
    if (errorCount) {
      errorCount.textContent = `${this.filteredErrors.length} errors found`;
    }

    if (pageErrors.length === 0) {
      errorList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <h3>No errors found</h3>
          <p>Try adjusting your filters or search terms.</p>
        </div>
      `;
    } else {
      errorList.innerHTML = pageErrors.map(error => this.renderErrorItem(error)).join('');
    }

    // Update pagination
    this.updatePagination(totalPages);
  }

  renderErrorItem(error) {
    const date = new Date(error.date);
    const timeAgo = this.getTimeAgo(date);
    const sectionLabel = this.getSectionLabel(error.section);
    const errorTypeLabel = this.getErrorTypeLabel(error.errorType);
    
    return `
      <div class="error-item" data-error-id="${error.id}" tabindex="0">
        <div class="error-item-header">
          <div class="error-badges">
            <span class="badge badge-section badge-${error.section}">${sectionLabel}</span>
            <span class="badge badge-error-type badge-${error.errorType}">${errorTypeLabel}</span>
          </div>
          <span class="error-time" title="${date.toLocaleString()}">${timeAgo}</span>
        </div>
        
        <div class="error-question-preview">
          ${this.truncate(error.questionStem, 120)}
        </div>
        
        <div class="error-item-footer">
          <div class="error-answer-info">
            <span class="answer-wrong">Your: ${error.userAnswer}</span>
            <span class="answer-correct">Correct: ${error.correctAnswer}</span>
          </div>
          <div class="error-meta">
            <span class="error-skill">${error.skill.replace(/-/g, ' ')}</span>
            <span class="error-time-spent">${this.formatTime(error.timeSpent)}</span>
          </div>
        </div>
        
        ${error.notes ? `<div class="error-notes">📝 ${error.notes}</div>` : ''}
      </div>
    `;
  }

  showErrorDetail(errorId) {
    const error = this.filteredErrors.find(e => e.id === errorId);
    if (!error) return;

    this.currentErrorIndex = this.filteredErrors.findIndex(e => e.id === errorId);
    
    const modal = this.container.querySelector('.error-detail-modal');
    const modalBody = this.container.querySelector('.modal-body');
    
    modalBody.innerHTML = `
      <div class="error-detail">
        <div class="detail-section">
          <div class="detail-badges">
            <span class="badge badge-section badge-${error.section}">
              ${this.getSectionLabel(error.section)}
            </span>
            <span class="badge badge-error-type badge-${error.errorType}">
              ${this.getErrorTypeLabel(error.errorType)}
            </span>
            <span class="badge badge-skill">${error.skill.replace(/-/g, ' ')}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Question</h4>
          <p class="question-stem">${error.questionStem}</p>
        </div>

        <div class="detail-section answers-section">
          <div class="answer-comparison">
            <div class="answer-box wrong">
              <span class="answer-label">Your Answer</span>
              <span class="answer-value">${error.userAnswer}</span>
            </div>
            <div class="answer-arrow">→</div>
            <div class="answer-box correct">
              <span class="answer-label">Correct Answer</span>
              <span class="answer-value">${error.correctAnswer}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Performance</h4>
          <div class="performance-stats">
            <div class="perf-stat">
              <span class="perf-label">Time Spent</span>
              <span class="perf-value">${this.formatTime(error.timeSpent)}</span>
            </div>
            <div class="perf-stat">
              <span class="perf-label">Date</span>
              <span class="perf-value">${new Date(error.date).toLocaleDateString()}</span>
            </div>
            <div class="perf-stat">
              <span class="perf-label">Question ID</span>
              <span class="perf-value">#${error.questionId}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Notes</h4>
          <textarea class="notes-input" 
                    placeholder="Add notes about this error..."
                    data-error-id="${error.id}">${error.notes || ''}</textarea>
        </div>
      </div>
    `;

    // Attach notes save handler
    const notesInput = modalBody.querySelector('.notes-input');
    notesInput?.addEventListener('blur', (e) => this.saveNotes(error.id, e.target.value));

    // Update navigation buttons
    const prevBtn = this.container.querySelector('.modal-prev');
    const nextBtn = this.container.querySelector('.modal-next');
    prevBtn.disabled = this.currentErrorIndex === 0;
    nextBtn.disabled = this.currentErrorIndex === this.filteredErrors.length - 1;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    const modal = this.container.querySelector('.error-detail-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  navigateError(direction) {
    const newIndex = this.currentErrorIndex + direction;
    if (newIndex >= 0 && newIndex < this.filteredErrors.length) {
      this.showErrorDetail(this.filteredErrors[newIndex].id);
    }
  }

  async saveNotes(errorId, notes) {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.notes = notes;
      // TODO: Save to backend
      // await this.api.updateErrorNotes(errorId, notes);
    }
  }

  async retryQuestion() {
    const error = this.filteredErrors[this.currentErrorIndex];
    if (error) {
      this.closeModal();
      // Emit event to start question
      const event = new CustomEvent('retry-question', {
        detail: { questionId: error.questionId }
      });
      this.container.dispatchEvent(event);
    }
  }

  updateFilterUI() {
    const activeFilters = this.container.querySelector('.active-filters');
    const filterTags = this.container.querySelector('.filter-tags');
    
    const activeFilterList = [];
    
    if (this.filters.section !== 'all') {
      activeFilterList.push({
        key: 'section',
        label: this.getSectionLabel(this.filters.section)
      });
    }
    if (this.filters.errorType !== 'all') {
      activeFilterList.push({
        key: 'errorType',
        label: this.getErrorTypeLabel(this.filters.errorType)
      });
    }
    if (this.filters.dateRange !== 'all') {
      activeFilterList.push({
        key: 'dateRange',
        label: this.getDateRangeLabel(this.filters.dateRange)
      });
    }
    if (this.filters.search) {
      activeFilterList.push({
        key: 'search',
        label: `"${this.filters.search}"`
      });
    }

    if (activeFilterList.length > 0) {
      activeFilters.style.display = 'flex';
      filterTags.innerHTML = activeFilterList.map(filter => `
        <span class="filter-tag" data-filter="${filter.key}">
          ${filter.label}
          <button class="filter-tag-remove" aria-label="Remove filter">×</button>
        </span>
      `).join('');

      // Attach remove handlers
      filterTags.querySelectorAll('.filter-tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tag = e.target.closest('.filter-tag');
          const filterKey = tag.dataset.filter;
          this.filters[filterKey] = filterKey === 'search' ? '' : 'all';
          
          // Reset corresponding select
          const select = this.container.querySelector(`[data-filter="${filterKey}"]`);
          if (select) select.value = 'all';
          
          // Reset search input
          if (filterKey === 'search') {
            const searchInput = this.container.querySelector('.search-input');
            if (searchInput) searchInput.value = '';
          }
          
          this.page = 1;
          this.applyFilters();
        });
      });
    } else {
      activeFilters.style.display = 'none';
    }
  }

  clearFilters() {
    this.filters = {
      section: 'all',
      errorType: 'all',
      skill: 'all',
      dateRange: 'all',
      search: ''
    };
    
    // Reset all inputs
    this.container.querySelectorAll('.filter-select').forEach(select => {
      select.value = 'all';
    });
    const searchInput = this.container.querySelector('.search-input');
    if (searchInput) searchInput.value = '';
    
    this.page = 1;
    this.applyFilters();
  }

  updatePagination(totalPages) {
    const prevBtn = this.container.querySelector('.pagination-prev');
    const nextBtn = this.container.querySelector('.pagination-next');
    const pageInfo = this.container.querySelector('.pagination-info');

    prevBtn.disabled = this.page === 1;
    nextBtn.disabled = this.page >= totalPages;
    pageInfo.textContent = `Page ${this.page} of ${totalPages || 1}`;
  }

  changePage(direction) {
    const totalPages = Math.ceil(this.filteredErrors.length / this.pageSize);
    const newPage = this.page + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
      this.page = newPage;
      this.renderErrorList();
      
      // Scroll to top of list
      const errorList = this.container.querySelector('.error-list');
      errorList?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Helper methods
  getSectionLabel(section) {
    const labels = {
      quant: 'Quantitative',
      verbal: 'Verbal',
      di: 'Data Insights'
    };
    return labels[section] || section;
  }

  getErrorTypeLabel(type) {
    const labels = {
      conceptual: 'Conceptual',
      careless: 'Careless',
      'time-pressure': 'Time Pressure',
      'trap-answer': 'Trap Answer'
    };
    return labels[type] || type;
  }

  getDateRangeLabel(range) {
    const labels = {
      today: 'Today',
      week: 'Past Week',
      month: 'Past Month'
    };
    return labels[range] || range;
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    
    return 'Just now';
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  truncate(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }
}
