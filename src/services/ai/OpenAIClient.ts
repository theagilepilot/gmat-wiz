/**
 * OpenAI API Client
 * Wrapper with error handling, rate limiting, and retry logic
 */

import { getConfig } from '../../config/index.js';
import type {
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  RateLimitConfig,
  RateLimitState,
} from './types.js';

// ============================================
// Constants
// ============================================

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerMinute: 60,
  tokensPerMinute: 90000,
  maxRetries: 3,
  retryDelayMs: 1000,
};

const DEFAULT_COMPLETION_OPTIONS: CompletionOptions = {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

// ============================================
// OpenAI Client Class
// ============================================

export class OpenAIClient {
  private apiKey: string;
  private model: string;
  private rateLimitConfig: RateLimitConfig;
  private rateLimitState: RateLimitState;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config?: { apiKey?: string; model?: string; rateLimit?: Partial<RateLimitConfig> }) {
    const appConfig = getConfig();
    
    this.apiKey = config?.apiKey ?? appConfig.openaiApiKey;
    this.model = config?.model ?? appConfig.openaiModel;
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not configured. AI features will be disabled.');
    }
    
    this.rateLimitConfig = {
      ...DEFAULT_RATE_LIMIT,
      ...config?.rateLimit,
    };
    
    this.rateLimitState = {
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      minuteStartTime: Date.now(),
      isLimited: false,
    };
  }

  /**
   * Check if the client is configured and ready
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Create a chat completion
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    await this.waitForRateLimit();

    const mergedOptions = { ...DEFAULT_COMPLETION_OPTIONS, ...options };
    const model = options?.model ?? this.model;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.rateLimitConfig.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest('/chat/completions', {
          model,
          messages,
          temperature: mergedOptions.temperature,
          max_tokens: mergedOptions.maxTokens,
          top_p: mergedOptions.topP,
          frequency_penalty: mergedOptions.frequencyPenalty,
          presence_penalty: mergedOptions.presencePenalty,
          stop: mergedOptions.stop,
        });

        const result = this.parseCompletionResponse(response, model);
        this.updateRateLimitState(result.usage.totalTokens);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (this.isRetryableError(error)) {
          const delay = this.rateLimitConfig.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }
        
        throw error;
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  /**
   * Create a JSON-mode chat completion (structured output)
   */
  async jsonCompletion<T>(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ data: T; usage: CompletionResult['usage'] }> {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    // Ensure system message requests JSON
    const jsonSystemMessage: ChatMessage = {
      role: 'system',
      content: systemMessage 
        ? `${systemMessage.content}\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanations outside the JSON.`
        : 'Respond with valid JSON only. No markdown, no explanations outside the JSON.',
    };

    const result = await this.chatCompletion(
      [jsonSystemMessage, ...otherMessages],
      options
    );

    try {
      // Try to extract JSON from the response
      let jsonStr = result.content.trim();
      
      // Handle markdown code blocks
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const data = JSON.parse(jsonStr) as T;
      return { data, usage: result.usage };
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response: ${(parseError as Error).message}\nResponse: ${result.content}`);
    }
  }

  /**
   * Simple text completion for shorter responses
   */
  async textCompletion(
    prompt: string,
    systemPrompt?: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const messages: ChatMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return this.chatCompletion(messages, options);
  }

  // ============================================
  // Private Methods
  // ============================================

  private async makeRequest(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      
      if (response.status === 429) {
        throw new RateLimitError('Rate limit exceeded', response.headers);
      }
      
      if (response.status === 401) {
        throw new AuthenticationError('Invalid API key');
      }
      
      if (response.status >= 500) {
        throw new ServerError(`OpenAI server error: ${response.status}`, response.status);
      }
      
      throw new APIError(`OpenAI API error: ${response.status} - ${errorBody}`, response.status);
    }

    return response.json();
  }

  private parseCompletionResponse(response: unknown, model: string): CompletionResult {
    const data = response as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      finishReason: data.choices[0]?.finish_reason as CompletionResult['finishReason'],
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model,
    };
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const minuteElapsed = now - this.rateLimitState.minuteStartTime;

    // Reset counters if a minute has passed
    if (minuteElapsed >= 60000) {
      this.rateLimitState = {
        requestsThisMinute: 0,
        tokensThisMinute: 0,
        minuteStartTime: now,
        isLimited: false,
      };
    }

    // Check if we're at the limit
    if (
      this.rateLimitState.requestsThisMinute >= this.rateLimitConfig.requestsPerMinute ||
      this.rateLimitState.tokensThisMinute >= this.rateLimitConfig.tokensPerMinute
    ) {
      const waitTime = 60000 - minuteElapsed;
      this.rateLimitState.isLimited = true;
      await this.sleep(waitTime);
      
      // Reset after waiting
      this.rateLimitState = {
        requestsThisMinute: 0,
        tokensThisMinute: 0,
        minuteStartTime: Date.now(),
        isLimited: false,
      };
    }

    this.rateLimitState.requestsThisMinute++;
  }

  private updateRateLimitState(tokensUsed: number): void {
    this.rateLimitState.tokensThisMinute += tokensUsed;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof RateLimitError) return true;
    if (error instanceof ServerError) return true;
    if (error instanceof Error && error.message.includes('ECONNRESET')) return true;
    if (error instanceof Error && error.message.includes('ETIMEDOUT')) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit state (for monitoring)
   */
  getRateLimitState(): RateLimitState {
    return { ...this.rateLimitState };
  }
}

// ============================================
// Custom Error Classes
// ============================================

export class APIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'APIError';
  }
}

export class RateLimitError extends APIError {
  public retryAfter: number | null;

  constructor(message: string, headers?: Headers) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = headers ? parseInt(headers.get('retry-after') ?? '60', 10) : null;
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class ServerError extends APIError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
    this.name = 'ServerError';
  }
}

// ============================================
// Singleton Instance
// ============================================

let clientInstance: OpenAIClient | null = null;

export function getOpenAIClient(): OpenAIClient {
  if (!clientInstance) {
    clientInstance = new OpenAIClient();
  }
  return clientInstance;
}

export function resetOpenAIClient(): void {
  clientInstance = null;
}
