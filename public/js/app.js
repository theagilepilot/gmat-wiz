/**
 * GMAT Ascension - Frontend Application
 * Minimal, keyboard-first UI
 */

import { Analytics } from './components/Analytics.js';
import { LevelProgress } from './components/LevelProgress.js';
import { ErrorLog } from './components/ErrorLog.js';
import { Settings } from './components/Settings.js';

// ================================
// State Management
// ================================
const state = {
  currentView: 'dashboard',
  user: null,
  currentBlock: null,
  dashboard: null,
  trainingBlock: null,
  analytics: null,
  levelProgress: null,
  errorLog: null,
  settings: null
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
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ================================
// View Management
// ================================
function showView(viewName, data = null) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.style.display = 'none';
  });
  
  // Hide loading screen
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.style.display = 'none';
  
  // Show requested view
  const targetView = document.getElementById(`${viewName}`);
  if (targetView) {
    targetView.style.display = 'block';
    state.currentView = viewName;
    
    // Set keyboard context
    const context = viewName.replace('-view', '');
    if (window.keyboard) {
      window.keyboard.setContext(context);
    }
    
    // Update nav buttons
    const navView = viewName.replace('-view', '');
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === navView);
    });
    
    // Handle view-specific initialization
    handleViewInit(viewName, data);
  }
}

function handleViewInit(viewName, data) {
  switch (viewName) {
    case 'dashboard-view':
      initDashboard();
      break;
    case 'question-view':
      if (data && data.block) {
        initTrainingBlock(data.block);
      }
      break;
    case 'analytics-view':
      initAnalytics();
      break;
    case 'levels-view':
      initLevelProgress();
      break;
    case 'errors-view':
      initErrorLog();
      break;
    case 'settings-view':
      initSettings();
      break;
  }
}

// ================================
// Dashboard
// ================================
async function initDashboard() {
  const container = document.getElementById('dashboard-view');
  
  // Cleanup previous instance
  if (state.dashboard) {
    state.dashboard.destroy?.();
  }
  
  // Create new dashboard
  state.dashboard = new Dashboard(container);
  await state.dashboard.init();
}

async function loadDashboard() {
  try {
    // Load health check to verify connection
    const health = await window.api.get('/health');
    
    if (health.status === 'error') {
      showToast('Database connection error', 'error');
      return;
    }
    
    if (health.checks?.openai === 'not_configured') {
      showToast('OpenAI API key not configured', 'warning', 5000);
    }
    
    // Update header level info
    document.getElementById('current-level').textContent = '1';
    document.getElementById('level-name').textContent = 'Orientation';
    
    showView('dashboard-view');
    
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    showToast('Failed to connect to server', 'error');
    
    // Still show dashboard view
    showView('dashboard-view');
  }
}

// ================================
// Training Block
// ================================
async function initTrainingBlock(block) {
  const container = document.getElementById('question-view');
  
  // Cleanup previous instance
  if (state.trainingBlock) {
    state.trainingBlock.destroy?.();
  }
  
  // Create new training block
  state.trainingBlock = new TrainingBlock(container);
  state.trainingBlock.onComplete = handleBlockComplete;
  state.trainingBlock.onAbandon = handleBlockAbandon;
  
  await state.trainingBlock.init(block);
}

function handleBlockComplete(block) {
  showToast('Block complete! Great work!', 'success');
  // Could show celebration, update stats, etc.
}

function handleBlockAbandon(block) {
  showToast('Session ended', 'info');
  showView('dashboard-view');
}

async function startTraining(mode) {
  try {
    const targetQuestions = {
      sprint: 10,
      endurance: 25,
      review: 15,
      mixed: 20
    };

    const block = await window.api.startBlock({
      mode,
      targetQuestions: targetQuestions[mode] || 10
    });

    showView('question-view', { block });
  } catch (error) {
    console.error('Failed to start training:', error);
    showToast('Failed to start training', 'error');
  }
}

// ================================
// Analytics View
// ================================
async function initAnalytics() {
  const container = document.getElementById('analytics-view');
  
  // Cleanup previous instance
  if (state.analytics) {
    state.analytics.destroy?.();
  }
  
  // Create new analytics
  state.analytics = new Analytics(container, window.api);
  await state.analytics.init();
}

// ================================
// Level Progress View
// ================================
async function initLevelProgress() {
  const container = document.getElementById('levels-view');
  
  // Cleanup previous instance
  if (state.levelProgress) {
    state.levelProgress.destroy?.();
  }
  
  // Create new level progress
  state.levelProgress = new LevelProgress(container, window.api);
  await state.levelProgress.init();
}

// ================================
// Error Log View
// ================================
async function initErrorLog() {
  const container = document.getElementById('errors-view');
  
  // Cleanup previous instance
  if (state.errorLog) {
    state.errorLog.destroy?.();
  }
  
  // Create new error log
  state.errorLog = new ErrorLog(container, window.api);
  await state.errorLog.init();
  
  // Listen for retry question events
  container.addEventListener('retry-question', (e) => {
    const { questionId } = e.detail;
    // TODO: Start a single question training with this question
    showToast(`Retry question #${questionId} - Coming soon`, 'info');
  });
}

// ================================
// Settings View
// ================================
async function initSettings() {
  const container = document.getElementById('settings-view');
  
  // Cleanup previous instance
  if (state.settings) {
    state.settings.destroy?.();
  }
  
  // Create new settings
  state.settings = new Settings(container, window.api);
  await state.settings.init();
}

// ================================
// Global Keyboard Shortcuts
// ================================
function setupKeyboardShortcuts() {
  if (!window.keyboard) return;
  
  // Dashboard shortcut
  window.keyboard.register('d', () => {
    showView('dashboard-view');
  }, {
    context: 'default',
    description: 'Go to dashboard'
  });
  
  // Analytics shortcut
  window.keyboard.register('a', () => {
    showView('analytics-view');
  }, {
    context: 'default',
    description: 'Go to analytics'
  });
  
  // Levels shortcut
  window.keyboard.register('l', () => {
    showView('levels-view');
  }, {
    context: 'default',
    description: 'Go to levels'
  });
  
  // Error log shortcut
  window.keyboard.register('e', () => {
    showView('errors-view');
  }, {
    context: 'default',
    description: 'Go to error log'
  });
  
  // Settings shortcut
  window.keyboard.register('s', () => {
    showView('settings-view');
  }, {
    context: 'default',
    description: 'Go to settings'
  });
  
  // Escape to go back
  window.keyboard.register('escape', () => {
    if (state.currentView !== 'dashboard-view') {
      showView('dashboard-view');
    }
  }, {
    context: 'default',
    description: 'Go back'
  });
  
  // Question mark for help
  window.keyboard.register('?', () => {
    showKeyboardHelp();
  }, {
    context: 'default',
    description: 'Show keyboard shortcuts'
  });
}

function showKeyboardHelp() {
  const shortcuts = window.keyboard?.getShortcuts() || [];
  const message = shortcuts.map(s => `${s.key.toUpperCase()}: ${s.description}`).join('\n');
  
  // For now, show in console and toast
  console.log('Keyboard shortcuts:', shortcuts);
  showToast('Press ? to see shortcuts (check console)', 'info');
}

// ================================
// Navigation
// ================================
function setupNavigation() {
  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      showView(`${view}-view`);
    });
  });
  
  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    showView('settings-view');
  });
}

// ================================
// Timer Display (Header)
// ================================
function updateHeaderTimer(seconds) {
  const value = document.getElementById('timer-value');
  const display = document.getElementById('timer-display');
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  value.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
  
  // Update warning states
  display.classList.remove('warning', 'danger');
  if (seconds <= 30) {
    display.classList.add('danger');
  } else if (seconds <= 60) {
    display.classList.add('warning');
  }
}

// ================================
// Initialization
// ================================
async function init() {
  console.log('🚀 GMAT Ascension initializing...');
  
  // Setup global shortcuts
  setupKeyboardShortcuts();
  setupNavigation();
  
  // Load dashboard
  await loadDashboard();
  
  console.log('✅ GMAT Ascension ready');
  console.log('💡 Press ? for keyboard shortcuts');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging and cross-component access
window.gmatApp = { 
  state, 
  showToast, 
  showView,
  startTraining,
  updateHeaderTimer
};
