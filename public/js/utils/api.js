/**
 * GMAT Ascension - API Client
 * Enhanced API client with error handling, retries, and type safety
 */

class APIClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.onError = options.onError || null;
    this.onUnauthorized = options.onUnauthorized || null;
  }

  /**
   * Make an HTTP request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   */
  async request(method, endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    let lastError;
    const maxAttempts = options.retries ?? this.retries;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, config);
        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          const error = await this._parseError(response);
          
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            if (response.status === 401 && this.onUnauthorized) {
              this.onUnauthorized();
            }
            throw error;
          }
          
          // Retry server errors (5xx)
          lastError = error;
          if (attempt < maxAttempts) {
            await this._delay(this.retryDelay * attempt);
            continue;
          }
          throw error;
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return null;

      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new APIError('Request timeout', 'TIMEOUT');
        }
        
        if (error instanceof APIError) {
          if (this.onError) this.onError(error);
          throw error;
        }

        // Network error - retry
        lastError = new APIError(error.message, 'NETWORK');
        if (attempt < maxAttempts) {
          await this._delay(this.retryDelay * attempt);
          continue;
        }
      }
    }

    if (this.onError) this.onError(lastError);
    throw lastError;
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.request('POST', endpoint, { ...options, body });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.request('PUT', endpoint, { ...options, body });
  }

  /**
   * PATCH request
   */
  async patch(endpoint, body, options = {}) {
    return this.request('PATCH', endpoint, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }

  /**
   * Parse error from response
   * @private
   */
  async _parseError(response) {
    let message = `HTTP ${response.status}`;
    let code = `HTTP_${response.status}`;
    let details = null;

    try {
      const data = await response.json();
      message = data.error || data.message || message;
      code = data.code || code;
      details = data.details || null;
    } catch {
      // Use default message
    }

    return new APIError(message, code, response.status, details);
  }

  /**
   * Delay helper
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * GMAT-specific API methods
 */
class GmatAPI extends APIClient {
  constructor(options = {}) {
    super(options);
  }

  // ========================
  // Dashboard / Session
  // ========================

  /**
   * Get today's session data
   */
  async getTodaySession() {
    return this.get('/sessions/today');
  }

  /**
   * Get user stats
   */
  async getStats() {
    return this.get('/stats');
  }

  /**
   * Get daily plan
   */
  async getDailyPlan() {
    return this.get('/plan/daily');
  }

  // ========================
  // Training Blocks
  // ========================

  /**
   * Start a new training block
   * @param {Object} params - Block parameters
   * @param {string} params.mode - Training mode (sprint, endurance, review, mixed)
   * @param {number} params.targetQuestions - Number of questions
   */
  async startBlock(params) {
    return this.post('/blocks', params);
  }

  /**
   * Get current active block
   */
  async getCurrentBlock() {
    return this.get('/blocks/current');
  }

  /**
   * Complete a block
   * @param {number} blockId - Block ID
   */
  async completeBlock(blockId) {
    return this.put(`/blocks/${blockId}/complete`);
  }

  /**
   * Abandon a block
   * @param {number} blockId - Block ID
   */
  async abandonBlock(blockId) {
    return this.put(`/blocks/${blockId}/abandon`);
  }

  // ========================
  // Questions
  // ========================

  /**
   * Get next question in block
   * @param {number} blockId - Block ID
   */
  async getNextQuestion(blockId) {
    return this.get(`/blocks/${blockId}/next-question`);
  }

  /**
   * Submit an answer
   * @param {Object} params - Answer parameters
   * @param {number} params.questionId - Question ID
   * @param {string} params.answer - Selected answer (A, B, C, D, E)
   * @param {number} params.timeSpent - Time spent in seconds
   * @param {number} params.blockId - Block ID
   */
  async submitAnswer(params) {
    return this.post('/attempts', params);
  }

  /**
   * Get question by ID
   * @param {number} questionId - Question ID
   */
  async getQuestion(questionId) {
    return this.get(`/questions/${questionId}`);
  }

  /**
   * Get question explanation
   * @param {number} questionId - Question ID
   */
  async getExplanation(questionId) {
    return this.get(`/questions/${questionId}/explanation`);
  }

  // ========================
  // Progress & Analytics
  // ========================

  /**
   * Get skill progress
   * @param {Object} params - Query parameters
   */
  async getSkillProgress(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/progress/skills${query ? '?' + query : ''}`);
  }

  /**
   * Get level progress
   */
  async getLevelProgress() {
    return this.get('/progress/level');
  }

  /**
   * Get recent attempts
   * @param {number} limit - Number of attempts
   */
  async getRecentAttempts(limit = 10) {
    return this.get(`/attempts/recent?limit=${limit}`);
  }

  /**
   * Get error log
   * @param {Object} params - Query parameters
   */
  async getErrorLog(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/errors${query ? '?' + query : ''}`);
  }

  /**
   * Get readiness score
   */
  async getReadiness() {
    return this.get('/readiness');
  }

  // ========================
  // AI Features
  // ========================

  /**
   * Generate a new question
   * @param {Object} params - Generation parameters
   */
  async generateQuestion(params) {
    return this.post('/ai/generate-question', params);
  }

  /**
   * Get AI feedback on attempt
   * @param {number} attemptId - Attempt ID
   */
  async getAIFeedback(attemptId) {
    return this.get(`/ai/feedback/${attemptId}`);
  }

  // ========================
  // Mastery Gates
  // ========================

  /**
   * Check mastery gate status
   * @param {string} skill - Skill code
   */
  async checkMasteryGate(skill) {
    return this.get(`/mastery-gates/${skill}`);
  }

  /**
   * Get all mastery gates
   */
  async getMasteryGates() {
    return this.get('/mastery-gates');
  }

  // ========================
  // Settings
  // ========================

  /**
   * Get user settings
   */
  async getSettings() {
    return this.get('/settings');
  }

  /**
   * Update settings
   * @param {Object} settings - Settings to update
   */
  async updateSettings(settings) {
    return this.put('/settings', settings);
  }
}

// Export
window.APIClient = APIClient;
window.APIError = APIError;
window.GmatAPI = GmatAPI;

// Create default instance
window.api = new GmatAPI({
  onError: (error) => {
    console.error('[API Error]', error);
    // Will be connected to toast system
    if (window.gmatApp && window.gmatApp.showToast) {
      window.gmatApp.showToast(error.message, 'error');
    }
  }
});
