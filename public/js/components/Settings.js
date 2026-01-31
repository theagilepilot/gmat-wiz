/**
 * GMAT Ascension - Settings Component
 * User preferences and configuration
 */

export class Settings {
  constructor(container, api) {
    this.container = container;
    this.api = api;
    this.settings = {};
    this.hasChanges = false;
    this.keyboardHandler = this.handleKeyboard.bind(this);
  }

  async init() {
    this.render();
    await this.loadSettings();
    this.attachEventListeners();
    document.addEventListener('keydown', this.keyboardHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.keyboardHandler);
    if (this.hasChanges) {
      this.saveSettings();
    }
  }

  async loadSettings() {
    try {
      const response = await this.api.getSettings();
      this.settings = response.settings || this.getDefaultSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
    }
    this.populateForm();
  }

  getDefaultSettings() {
    return {
      // Training Preferences
      training: {
        defaultBlockSize: 10,
        defaultTimeLimit: 120,
        showTimer: true,
        showProgress: true,
        autoAdvance: false,
        shuffleQuestions: true,
        enableHints: true
      },
      // Interface
      interface: {
        theme: 'dark',
        fontSize: 'medium',
        keyboardShortcuts: true,
        soundEffects: false,
        animations: true,
        compactMode: false
      },
      // Notifications
      notifications: {
        dailyReminder: false,
        reminderTime: '09:00',
        weeklyReport: true,
        achievementAlerts: true
      },
      // Data
      data: {
        syncEnabled: false,
        autoBackup: true,
        backupFrequency: 'daily'
      },
      // Accessibility
      accessibility: {
        highContrast: false,
        reduceMotion: false,
        screenReaderOptimized: false
      }
    };
  }

  render() {
    this.container.innerHTML = `
      <div class="settings-view">
        <header class="settings-header">
          <h2>Settings</h2>
          <div class="settings-actions">
            <button class="btn btn-secondary reset-settings">Reset to Defaults</button>
            <button class="btn btn-primary save-settings" disabled>Save Changes</button>
          </div>
        </header>

        <div class="settings-content">
          <!-- Training Preferences -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">🎯</span>
              <div>
                <h3>Training Preferences</h3>
                <p class="section-desc">Configure your training experience</p>
              </div>
            </div>

            <div class="settings-group">
              <div class="setting-item">
                <div class="setting-info">
                  <label for="defaultBlockSize">Default Block Size</label>
                  <span class="setting-desc">Number of questions per training block</span>
                </div>
                <select id="defaultBlockSize" class="setting-input" data-path="training.defaultBlockSize">
                  <option value="5">5 questions</option>
                  <option value="10">10 questions</option>
                  <option value="15">15 questions</option>
                  <option value="20">20 questions</option>
                  <option value="25">25 questions</option>
                </select>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="defaultTimeLimit">Default Time per Question</label>
                  <span class="setting-desc">Time limit in seconds (0 for unlimited)</span>
                </div>
                <select id="defaultTimeLimit" class="setting-input" data-path="training.defaultTimeLimit">
                  <option value="0">Unlimited</option>
                  <option value="60">60 seconds</option>
                  <option value="90">90 seconds</option>
                  <option value="120">120 seconds</option>
                  <option value="150">150 seconds</option>
                  <option value="180">180 seconds</option>
                </select>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="showTimer">Show Timer</label>
                  <span class="setting-desc">Display countdown timer during questions</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="showTimer" data-path="training.showTimer">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="showProgress">Show Progress</label>
                  <span class="setting-desc">Display question progress indicator</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="showProgress" data-path="training.showProgress">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="autoAdvance">Auto-Advance</label>
                  <span class="setting-desc">Automatically move to next question after answering</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="autoAdvance" data-path="training.autoAdvance">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="shuffleQuestions">Shuffle Questions</label>
                  <span class="setting-desc">Randomize question order in training blocks</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="shuffleQuestions" data-path="training.shuffleQuestions">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="enableHints">Enable Hints</label>
                  <span class="setting-desc">Allow hint requests during practice</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="enableHints" data-path="training.enableHints">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </section>

          <!-- Interface -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">🎨</span>
              <div>
                <h3>Interface</h3>
                <p class="section-desc">Customize appearance and behavior</p>
              </div>
            </div>

            <div class="settings-group">
              <div class="setting-item">
                <div class="setting-info">
                  <label for="theme">Theme</label>
                  <span class="setting-desc">Color scheme for the interface</span>
                </div>
                <select id="theme" class="setting-input" data-path="interface.theme">
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="fontSize">Font Size</label>
                  <span class="setting-desc">Text size throughout the app</span>
                </div>
                <select id="fontSize" class="setting-input" data-path="interface.fontSize">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="keyboardShortcuts">Keyboard Shortcuts</label>
                  <span class="setting-desc">Enable keyboard navigation (1-5, Enter, etc.)</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="keyboardShortcuts" data-path="interface.keyboardShortcuts">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="soundEffects">Sound Effects</label>
                  <span class="setting-desc">Play sounds for correct/incorrect answers</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="soundEffects" data-path="interface.soundEffects">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="animations">Animations</label>
                  <span class="setting-desc">Enable smooth transitions and animations</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="animations" data-path="interface.animations">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="compactMode">Compact Mode</label>
                  <span class="setting-desc">Reduce spacing for smaller screens</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="compactMode" data-path="interface.compactMode">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </section>

          <!-- Notifications -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">🔔</span>
              <div>
                <h3>Notifications</h3>
                <p class="section-desc">Manage reminders and alerts</p>
              </div>
            </div>

            <div class="settings-group">
              <div class="setting-item">
                <div class="setting-info">
                  <label for="dailyReminder">Daily Reminder</label>
                  <span class="setting-desc">Get reminded to practice every day</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="dailyReminder" data-path="notifications.dailyReminder">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item" data-depends-on="dailyReminder">
                <div class="setting-info">
                  <label for="reminderTime">Reminder Time</label>
                  <span class="setting-desc">When to receive daily reminders</span>
                </div>
                <input type="time" id="reminderTime" class="setting-input" data-path="notifications.reminderTime">
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="weeklyReport">Weekly Report</label>
                  <span class="setting-desc">Receive weekly progress summary</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="weeklyReport" data-path="notifications.weeklyReport">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="achievementAlerts">Achievement Alerts</label>
                  <span class="setting-desc">Notify when earning achievements</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="achievementAlerts" data-path="notifications.achievementAlerts">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </section>

          <!-- Data Management -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">💾</span>
              <div>
                <h3>Data Management</h3>
                <p class="section-desc">Backup and sync options</p>
              </div>
            </div>

            <div class="settings-group">
              <div class="setting-item">
                <div class="setting-info">
                  <label for="autoBackup">Auto Backup</label>
                  <span class="setting-desc">Automatically backup your data locally</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="autoBackup" data-path="data.autoBackup">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item" data-depends-on="autoBackup">
                <div class="setting-info">
                  <label for="backupFrequency">Backup Frequency</label>
                  <span class="setting-desc">How often to create backups</span>
                </div>
                <select id="backupFrequency" class="setting-input" data-path="data.backupFrequency">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="session">After each session</option>
                </select>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Export Data</label>
                  <span class="setting-desc">Download all your progress and history</span>
                </div>
                <button class="btn btn-secondary export-data">Export JSON</button>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Import Data</label>
                  <span class="setting-desc">Restore from a backup file</span>
                </div>
                <label class="btn btn-secondary import-data">
                  Import
                  <input type="file" accept=".json" style="display: none;">
                </label>
              </div>

              <div class="setting-item danger">
                <div class="setting-info">
                  <label>Reset Progress</label>
                  <span class="setting-desc">Clear all training data and start fresh</span>
                </div>
                <button class="btn btn-danger reset-progress">Reset All Data</button>
              </div>
            </div>
          </section>

          <!-- Accessibility -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">♿</span>
              <div>
                <h3>Accessibility</h3>
                <p class="section-desc">Make the app easier to use</p>
              </div>
            </div>

            <div class="settings-group">
              <div class="setting-item">
                <div class="setting-info">
                  <label for="highContrast">High Contrast</label>
                  <span class="setting-desc">Increase color contrast for better visibility</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="highContrast" data-path="accessibility.highContrast">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="reduceMotion">Reduce Motion</label>
                  <span class="setting-desc">Minimize animations and transitions</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="reduceMotion" data-path="accessibility.reduceMotion">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label for="screenReaderOptimized">Screen Reader Optimized</label>
                  <span class="setting-desc">Enhanced support for screen readers</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="screenReaderOptimized" data-path="accessibility.screenReaderOptimized">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </section>

          <!-- Keyboard Shortcuts Reference -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">⌨️</span>
              <div>
                <h3>Keyboard Shortcuts</h3>
                <p class="section-desc">Quick reference for keyboard navigation</p>
              </div>
            </div>

            <div class="shortcuts-grid">
              <div class="shortcut-group">
                <h4>Questions</h4>
                <div class="shortcut-item">
                  <kbd>1</kbd>-<kbd>5</kbd>
                  <span>Select answer choice</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Enter</kbd>
                  <span>Submit / Next question</span>
                </div>
                <div class="shortcut-item">
                  <kbd>H</kbd>
                  <span>Show hint</span>
                </div>
                <div class="shortcut-item">
                  <kbd>F</kbd>
                  <span>Flag question</span>
                </div>
              </div>

              <div class="shortcut-group">
                <h4>Navigation</h4>
                <div class="shortcut-item">
                  <kbd>←</kbd>/<kbd>→</kbd>
                  <span>Previous/Next</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Esc</kbd>
                  <span>Close modal/Cancel</span>
                </div>
                <div class="shortcut-item">
                  <kbd>?</kbd>
                  <span>Show shortcuts help</span>
                </div>
              </div>

              <div class="shortcut-group">
                <h4>Global</h4>
                <div class="shortcut-item">
                  <kbd>Ctrl</kbd>+<kbd>F</kbd>
                  <span>Search</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Ctrl</kbd>+<kbd>S</kbd>
                  <span>Save</span>
                </div>
              </div>
            </div>
          </section>

          <!-- About -->
          <section class="settings-section">
            <div class="section-header">
              <span class="section-icon">ℹ️</span>
              <div>
                <h3>About</h3>
                <p class="section-desc">App information</p>
              </div>
            </div>

            <div class="about-info">
              <div class="about-item">
                <span class="about-label">Version</span>
                <span class="about-value">1.0.0</span>
              </div>
              <div class="about-item">
                <span class="about-label">Build</span>
                <span class="about-value">Phase 8</span>
              </div>
              <div class="about-item">
                <span class="about-label">Database</span>
                <span class="about-value">SQLite (Local)</span>
              </div>
            </div>
          </section>
        </div>

        <!-- Unsaved Changes Banner -->
        <div class="unsaved-banner" style="display: none;">
          <span>You have unsaved changes</span>
          <div class="banner-actions">
            <button class="btn btn-text discard-changes">Discard</button>
            <button class="btn btn-primary save-changes">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  populateForm() {
    // Populate all inputs based on settings
    this.container.querySelectorAll('[data-path]').forEach(input => {
      const path = input.dataset.path;
      const value = this.getNestedValue(this.settings, path);
      
      if (input.type === 'checkbox') {
        input.checked = value;
      } else {
        input.value = value;
      }
    });

    // Update dependent fields visibility
    this.updateDependentFields();
  }

  attachEventListeners() {
    // All inputs
    this.container.querySelectorAll('[data-path]').forEach(input => {
      input.addEventListener('change', (e) => this.handleChange(e));
    });

    // Save button
    const saveBtn = this.container.querySelector('.save-settings');
    saveBtn?.addEventListener('click', () => this.saveSettings());

    // Reset to defaults
    const resetBtn = this.container.querySelector('.reset-settings');
    resetBtn?.addEventListener('click', () => this.resetToDefaults());

    // Export data
    const exportBtn = this.container.querySelector('.export-data');
    exportBtn?.addEventListener('click', () => this.exportData());

    // Import data
    const importInput = this.container.querySelector('.import-data input');
    importInput?.addEventListener('change', (e) => this.importData(e));

    // Reset progress
    const resetProgressBtn = this.container.querySelector('.reset-progress');
    resetProgressBtn?.addEventListener('click', () => this.resetProgress());

    // Unsaved banner buttons
    const discardBtn = this.container.querySelector('.discard-changes');
    const saveBannerBtn = this.container.querySelector('.save-changes');
    discardBtn?.addEventListener('click', () => this.discardChanges());
    saveBannerBtn?.addEventListener('click', () => this.saveSettings());
  }

  handleKeyboard(e) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (this.hasChanges) {
        this.saveSettings();
      }
    }
  }

  handleChange(e) {
    const input = e.target;
    const path = input.dataset.path;
    const value = input.type === 'checkbox' ? input.checked : input.value;

    this.setNestedValue(this.settings, path, value);
    this.markAsChanged();
    this.updateDependentFields();
    this.applyImmediateChanges(path, value);
  }

  applyImmediateChanges(path, value) {
    // Apply certain settings immediately without saving
    switch (path) {
      case 'interface.theme':
        document.documentElement.dataset.theme = value;
        break;
      case 'interface.fontSize':
        document.documentElement.dataset.fontSize = value;
        break;
      case 'accessibility.highContrast':
        document.documentElement.classList.toggle('high-contrast', value);
        break;
      case 'accessibility.reduceMotion':
        document.documentElement.classList.toggle('reduce-motion', value);
        break;
    }
  }

  updateDependentFields() {
    this.container.querySelectorAll('[data-depends-on]').forEach(item => {
      const dependsOn = item.dataset.dependsOn;
      const parentInput = this.container.querySelector(`#${dependsOn}`);
      
      if (parentInput) {
        const isEnabled = parentInput.checked;
        item.style.display = isEnabled ? '' : 'none';
        
        // Disable inputs in hidden section
        item.querySelectorAll('input, select').forEach(input => {
          input.disabled = !isEnabled;
        });
      }
    });
  }

  markAsChanged() {
    this.hasChanges = true;
    
    const saveBtn = this.container.querySelector('.save-settings');
    if (saveBtn) saveBtn.disabled = false;

    const banner = this.container.querySelector('.unsaved-banner');
    if (banner) banner.style.display = 'flex';
  }

  clearChangedState() {
    this.hasChanges = false;
    
    const saveBtn = this.container.querySelector('.save-settings');
    if (saveBtn) saveBtn.disabled = true;

    const banner = this.container.querySelector('.unsaved-banner');
    if (banner) banner.style.display = 'none';
  }

  async saveSettings() {
    try {
      await this.api.saveSettings(this.settings);
      this.clearChangedState();
      this.showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  discardChanges() {
    this.loadSettings();
    this.clearChangedState();
  }

  resetToDefaults() {
    if (confirm('Reset all settings to default values?')) {
      this.settings = this.getDefaultSettings();
      this.populateForm();
      this.markAsChanged();
    }
  }

  async exportData() {
    try {
      const response = await this.api.exportData();
      const data = response.data || { settings: this.settings };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `gmat-ascension-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showToast('Data exported successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('Export failed', 'error');
    }
  }

  async importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (confirm('This will overwrite your current data. Continue?')) {
        await this.api.importData(data);
        this.showToast('Data imported successfully', 'success');
        // Reload settings
        await this.loadSettings();
      }
    } catch (error) {
      console.error('Import failed:', error);
      this.showToast('Invalid backup file', 'error');
    }
    
    // Reset file input
    e.target.value = '';
  }

  async resetProgress() {
    if (confirm('⚠️ This will permanently delete all your progress, history, and statistics. This cannot be undone.\n\nAre you sure you want to continue?')) {
      if (confirm('Final confirmation: Delete ALL data?')) {
        try {
          await this.api.resetAllData();
          this.showToast('All data has been reset', 'success');
          // Redirect to home
          window.location.reload();
        } catch (error) {
          console.error('Reset failed:', error);
          this.showToast('Reset failed', 'error');
        }
      }
    }
  }

  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to container
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Helper methods for nested object access
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}
