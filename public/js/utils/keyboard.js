/**
 * GMAT Ascension - Keyboard Utility
 * Handles keyboard navigation and shortcuts
 */

class KeyboardManager {
  constructor() {
    this.shortcuts = new Map();
    this.context = 'default';
    this.enabled = true;
    this.listeners = [];
    
    this._handleKeydown = this._handleKeydown.bind(this);
    document.addEventListener('keydown', this._handleKeydown);
  }

  /**
   * Register a keyboard shortcut
   * @param {string} key - Key or key combination (e.g., 'a', 'Enter', 'Ctrl+S')
   * @param {Function} callback - Function to execute
   * @param {Object} options - Options
   * @param {string} options.context - Context in which shortcut is active (default: 'default')
   * @param {string} options.description - Human-readable description
   * @param {boolean} options.preventDefault - Whether to prevent default behavior
   */
  register(key, callback, options = {}) {
    const normalizedKey = this._normalizeKey(key);
    const context = options.context || 'default';
    
    if (!this.shortcuts.has(context)) {
      this.shortcuts.set(context, new Map());
    }
    
    this.shortcuts.get(context).set(normalizedKey, {
      callback,
      description: options.description || '',
      preventDefault: options.preventDefault !== false
    });
    
    return this;
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key, context = 'default') {
    const normalizedKey = this._normalizeKey(key);
    if (this.shortcuts.has(context)) {
      this.shortcuts.get(context).delete(normalizedKey);
    }
    return this;
  }

  /**
   * Set the current context
   */
  setContext(context) {
    this.context = context;
    this._notifyListeners('contextChange', context);
    return this;
  }

  /**
   * Get current context
   */
  getContext() {
    return this.context;
  }

  /**
   * Enable/disable keyboard shortcuts
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    return this;
  }

  /**
   * Get all shortcuts for current context
   */
  getShortcuts() {
    const shortcuts = [];
    
    // Get default shortcuts
    if (this.shortcuts.has('default')) {
      for (const [key, value] of this.shortcuts.get('default')) {
        shortcuts.push({ key, ...value, context: 'default' });
      }
    }
    
    // Get context-specific shortcuts
    if (this.context !== 'default' && this.shortcuts.has(this.context)) {
      for (const [key, value] of this.shortcuts.get(this.context)) {
        shortcuts.push({ key, ...value, context: this.context });
      }
    }
    
    return shortcuts;
  }

  /**
   * Add listener for keyboard events
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  /**
   * Check if current focus is in an input field
   */
  isInputFocused() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    const tagName = activeElement.tagName.toLowerCase();
    const isContentEditable = activeElement.isContentEditable;
    
    return tagName === 'input' || 
           tagName === 'textarea' || 
           tagName === 'select' ||
           isContentEditable;
  }

  /**
   * Handle keydown events
   * @private
   */
  _handleKeydown(event) {
    if (!this.enabled) return;
    
    // Don't handle if typing in an input (unless it's a special key)
    if (this.isInputFocused() && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Allow escape to still work
      if (event.key !== 'Escape') return;
    }
    
    const normalizedKey = this._eventToKey(event);
    let shortcut = null;
    
    // Check context-specific shortcuts first
    if (this.context !== 'default' && this.shortcuts.has(this.context)) {
      shortcut = this.shortcuts.get(this.context).get(normalizedKey);
    }
    
    // Fall back to default context
    if (!shortcut && this.shortcuts.has('default')) {
      shortcut = this.shortcuts.get('default').get(normalizedKey);
    }
    
    if (shortcut) {
      if (shortcut.preventDefault) {
        event.preventDefault();
      }
      shortcut.callback(event);
      this._notifyListeners('shortcut', { key: normalizedKey, event });
    }
  }

  /**
   * Normalize a key string
   * @private
   */
  _normalizeKey(key) {
    return key.toLowerCase()
      .replace(/\s+/g, '')
      .split('+')
      .sort()
      .join('+');
  }

  /**
   * Convert keyboard event to normalized key string
   * @private
   */
  _eventToKey(event) {
    const parts = [];
    
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    
    // Normalize key name
    let key = event.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (key === 'arrowup') key = 'up';
    if (key === 'arrowdown') key = 'down';
    if (key === 'arrowleft') key = 'left';
    if (key === 'arrowright') key = 'right';
    
    // Don't add modifier keys as the main key
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }
    
    return parts.sort().join('+');
  }

  /**
   * Notify listeners
   * @private
   */
  _notifyListeners(type, data) {
    for (const listener of this.listeners) {
      listener(type, data);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    document.removeEventListener('keydown', this._handleKeydown);
    this.shortcuts.clear();
    this.listeners = [];
  }
}

/**
 * Choice navigation helper
 */
class ChoiceNavigator {
  constructor(options = {}) {
    this.containerSelector = options.container || '.choice-list';
    this.choiceSelector = options.choice || '.choice';
    this.selectedClass = options.selectedClass || 'selected';
    this.currentIndex = -1;
    this.onSelect = options.onSelect || (() => {});
  }

  /**
   * Get all choice elements
   */
  getChoices() {
    const container = document.querySelector(this.containerSelector);
    return container ? Array.from(container.querySelectorAll(this.choiceSelector)) : [];
  }

  /**
   * Select a choice by index
   */
  selectByIndex(index) {
    const choices = this.getChoices();
    if (index < 0 || index >= choices.length) return;
    
    // Remove selection from all
    choices.forEach(c => c.classList.remove(this.selectedClass));
    
    // Add selection to target
    choices[index].classList.add(this.selectedClass);
    this.currentIndex = index;
    
    // Scroll into view if needed
    choices[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    
    this.onSelect(index, choices[index]);
  }

  /**
   * Select by letter (A, B, C, D, E)
   */
  selectByLetter(letter) {
    const index = letter.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
    this.selectByIndex(index);
  }

  /**
   * Move selection up
   */
  moveUp() {
    const choices = this.getChoices();
    if (choices.length === 0) return;
    
    const newIndex = this.currentIndex <= 0 ? choices.length - 1 : this.currentIndex - 1;
    this.selectByIndex(newIndex);
  }

  /**
   * Move selection down
   */
  moveDown() {
    const choices = this.getChoices();
    if (choices.length === 0) return;
    
    const newIndex = this.currentIndex >= choices.length - 1 ? 0 : this.currentIndex + 1;
    this.selectByIndex(newIndex);
  }

  /**
   * Get current selection
   */
  getCurrentSelection() {
    const choices = this.getChoices();
    if (this.currentIndex < 0 || this.currentIndex >= choices.length) return null;
    return {
      index: this.currentIndex,
      element: choices[this.currentIndex],
      letter: String.fromCharCode(65 + this.currentIndex) // A, B, C, D, E
    };
  }

  /**
   * Clear selection
   */
  clearSelection() {
    const choices = this.getChoices();
    choices.forEach(c => c.classList.remove(this.selectedClass));
    this.currentIndex = -1;
  }
}

// Export for use
window.KeyboardManager = KeyboardManager;
window.ChoiceNavigator = ChoiceNavigator;

// Create default instance
window.keyboard = new KeyboardManager();
