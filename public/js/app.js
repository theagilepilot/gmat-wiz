/**
 * GMAT Ascension - Frontend Application
 * Minimal, keyboard-first UI
 */

// ================================
// API Client
// ================================
const api = {
  baseUrl: '/api',
  
  async get(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  },
  
  async post(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  },
  
  async put(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// ================================
// State Management
// ================================
const state = {
  currentView: 'dashboard',
  user: null,
  currentQuestion: null,
  selectedAnswer: null,
  timerInterval: null,
  timeRemaining: 0,
  trainingMode: 'build', // 'build' or 'prove'
};

// ================================
// Toast Notifications
// ================================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ================================
// View Management
// ================================
function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.style.display = 'none';
  });
  
  // Show loading screen while transitioning
  const loadingScreen = document.getElementById('loading-screen');
  
  // Show requested view
  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    loadingScreen.style.display = 'none';
    targetView.style.display = 'block';
    state.currentView = viewName;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
  }
}

// ================================
// Timer
// ================================
function startTimer(seconds, onComplete) {
  state.timeRemaining = seconds;
  updateTimerDisplay();
  
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }
  
  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    updateTimerDisplay();
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.timerInterval);
      if (onComplete) onComplete();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const value = document.getElementById('timer-value');
  
  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = state.timeRemaining % 60;
  value.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Update warning states
  display.classList.remove('warning', 'danger');
  if (state.timeRemaining <= 30) {
    display.classList.add('danger');
  } else if (state.timeRemaining <= 60) {
    display.classList.add('warning');
  }
}

// ================================
// Dashboard
// ================================
async function loadDashboard() {
  try {
    // Load health check to verify connection
    const health = await api.get('/health');
    
    if (health.status === 'error') {
      showToast('Database connection error', 'error');
      return;
    }
    
    if (health.checks.openai === 'not_configured') {
      showToast('OpenAI API key not configured', 'warning', 5000);
    }
    
    // For now, show placeholder data
    // These will be replaced with real API calls in later phases
    document.getElementById('current-level').textContent = '1';
    document.getElementById('level-name').textContent = 'Orientation';
    
    document.getElementById('stat-streak').textContent = '0';
    document.getElementById('stat-xp').textContent = '0';
    document.getElementById('stat-accuracy').textContent = '--%';
    document.getElementById('stat-questions').textContent = '0';
    
    const gauge = document.getElementById('readiness-gauge');
    gauge.querySelector('.gauge-value').textContent = '0';
    gauge.querySelector('.gauge-label').textContent = 'Begin your journey';
    
    // Placeholder training blocks
    const blocksContainer = document.getElementById('training-blocks');
    blocksContainer.innerHTML = `
      <div class="training-block" onclick="startTrainingBlock('orientation')">
        <span class="block-icon">📚</span>
        <div class="block-info">
          <div class="block-goal">GMAT Orientation</div>
          <div class="block-meta">Learn the test structure • ~15 min</div>
        </div>
      </div>
      <div class="training-block" onclick="showToast('Complete orientation first', 'warning')">
        <span class="block-icon">🔒</span>
        <div class="block-info">
          <div class="block-goal">Foundation: Arithmetic</div>
          <div class="block-meta">Locked • Complete Level 1</div>
        </div>
      </div>
    `;
    
    showView('dashboard');
    
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    showToast('Failed to connect to server', 'error');
  }
}

// ================================
// Question Flow (Placeholder)
// ================================
function startTrainingBlock(blockType) {
  showToast(`Training block "${blockType}" coming in Phase 4+`, 'info');
}

function selectAnswer(choice) {
  state.selectedAnswer = choice;
  
  // Update UI
  document.querySelectorAll('.choice').forEach(el => {
    el.classList.remove('selected');
  });
  
  const selectedEl = document.querySelector(`[data-choice="${choice}"]`);
  if (selectedEl) {
    selectedEl.classList.add('selected');
  }
  
  // Enable submit button
  document.getElementById('submit-btn').disabled = false;
}

// ================================
// Keyboard Shortcuts
// ================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Global shortcuts
    switch (e.key.toLowerCase()) {
      case 'd':
        showView('dashboard');
        break;
      case 'escape':
        if (state.currentView !== 'dashboard') {
          showView('dashboard');
        }
        break;
    }
    
    // Question view shortcuts
    if (state.currentView === 'question') {
      switch (e.key.toLowerCase()) {
        case 'a':
        case 'b':
        case 'c':
        case 'd':
        case 'e':
          selectAnswer(e.key.toUpperCase());
          break;
        case 'enter':
          if (state.selectedAnswer) {
            document.getElementById('submit-btn').click();
          }
          break;
        case 'h':
          document.getElementById('hint-btn').click();
          break;
      }
    }
  });
}

// ================================
// Navigation
// ================================
function setupNavigation() {
  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'dashboard') {
        loadDashboard();
      } else {
        showToast(`${view} view coming in Phase 8`, 'info');
      }
    });
  });
  
  // Dashboard action buttons
  document.getElementById('start-training-btn')?.addEventListener('click', () => {
    startTrainingBlock('daily');
  });
  
  document.getElementById('view-analytics-btn')?.addEventListener('click', () => {
    showToast('Analytics view coming in Phase 8', 'info');
  });
  
  document.getElementById('view-levels-btn')?.addEventListener('click', () => {
    showToast('Levels view coming in Phase 8', 'info');
  });
  
  document.getElementById('view-errors-btn')?.addEventListener('click', () => {
    showToast('Error log coming in Phase 8', 'info');
  });
  
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    showToast('Settings coming in Phase 8', 'info');
  });
}

// ================================
// Initialization
// ================================
async function init() {
  console.log('🚀 GMAT Ascension initializing...');
  
  setupKeyboardShortcuts();
  setupNavigation();
  
  // Load dashboard
  await loadDashboard();
  
  console.log('✅ GMAT Ascension ready');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.gmatApp = { state, api, showToast, showView };
