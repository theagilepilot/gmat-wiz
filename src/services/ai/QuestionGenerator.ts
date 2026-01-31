/**
 * Question Generator Service
 * Orchestrates AI question generation using section-specific prompts
 */

import { v4 as uuidv4 } from 'uuid';
import { getOpenAIClient } from './OpenAIClient.js';
import type {
  GenerationRequest,
  GeneratedQuestion,
  QuestionChoice,
  DSQuestion,
  RCQuestion,
  GenerationPipelineResult,
  ChatMessage,
} from './types.js';
import { buildQuantPrompt } from './prompts/quant.js';
import { buildVerbalPrompt } from './prompts/verbal.js';
import { buildIRPrompt } from './prompts/ir.js';
import { buildCompleteAWAPrompt } from './prompts/awa.js';

// ============================================
// Question Generator Class
// ============================================

export class QuestionGenerator {
  private client = getOpenAIClient();

  /**
   * Generate a single question based on the request
   */
  async generateQuestion(request: GenerationRequest): Promise<GenerationPipelineResult> {
    const generationId = uuidv4();
    const errors: string[] = [];
    let totalTokens = 0;

    if (!this.client.isConfigured()) {
      return {
        success: false,
        question: null,
        validation: null,
        attempts: 0,
        totalTokens: 0,
        errors: ['OpenAI API key not configured'],
      };
    }

    try {
      // Build prompts based on section
      const { systemPrompt, userPrompt } = this.buildPrompts(request);

      // Generate the question
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await this.client.jsonCompletion<RawGeneratedQuestion>(messages, {
        temperature: 0.8, // Slightly higher for variety
        maxTokens: 3000,
      });

      totalTokens = result.usage.totalTokens;

      // Parse and normalize the response
      const question = this.normalizeQuestion(result.data, request, generationId);

      return {
        success: true,
        question,
        validation: null, // Validation done separately
        attempts: 1,
        totalTokens,
        errors: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        success: false,
        question: null,
        validation: null,
        attempts: 1,
        totalTokens,
        errors,
      };
    }
  }

  /**
   * Generate multiple questions with retry logic
   */
  async generateWithRetry(
    request: GenerationRequest,
    maxAttempts: number = 3
  ): Promise<GenerationPipelineResult> {
    let lastResult: GenerationPipelineResult | null = null;
    let totalTokens = 0;
    const allErrors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.generateQuestion(request);
      totalTokens += result.totalTokens;
      
      if (result.success && result.question) {
        return {
          ...result,
          attempts: attempt,
          totalTokens,
        };
      }

      allErrors.push(...result.errors.map(e => `Attempt ${attempt}: ${e}`));
      lastResult = result;

      // Add slight variation for retry
      request = {
        ...request,
        targetDifficulty: request.targetDifficulty + (Math.random() - 0.5) * 20,
      };
    }

    return {
      success: false,
      question: lastResult?.question ?? null,
      validation: null,
      attempts: maxAttempts,
      totalTokens,
      errors: allErrors,
    };
  }

  /**
   * Generate a Data Sufficiency question
   */
  async generateDSQuestion(request: GenerationRequest): Promise<GenerationPipelineResult> {
    return this.generateQuestion({
      ...request,
      section: 'quant',
      questionType: 'data_sufficiency',
    });
  }

  /**
   * Generate a Reading Comprehension question with passage
   */
  async generateRCQuestion(request: GenerationRequest): Promise<GenerationPipelineResult> {
    return this.generateQuestion({
      ...request,
      section: 'verbal',
      questionType: 'reading_comprehension',
    });
  }

  // ============================================
  // Private Methods
  // ============================================

  private buildPrompts(request: GenerationRequest): {
    systemPrompt: string;
    userPrompt: string;
  } {
    switch (request.section) {
      case 'quant':
        return buildQuantPrompt(request);
      
      case 'verbal':
        return buildVerbalPrompt(request);
      
      case 'ir':
        return buildIRPrompt(request);
      
      case 'awa':
        return buildCompleteAWAPrompt(request);
      
      default:
        throw new Error(`Unknown section: ${request.section}`);
    }
  }

  private normalizeQuestion(
    raw: RawGeneratedQuestion,
    request: GenerationRequest,
    generationId: string
  ): GeneratedQuestion {
    // Ensure choices array is properly formatted
    const choices: QuestionChoice[] = (raw.choices || []).map((c, i) => ({
      label: c.label || String.fromCharCode(65 + i), // A, B, C, D, E
      text: c.text || '',
      isCorrect: c.isCorrect ?? (c.label === raw.correctAnswer),
      trapType: c.trapType || undefined,
    }));

    // Validate exactly one correct answer
    const correctCount = choices.filter(c => c.isCorrect).length;
    if (correctCount !== 1) {
      // Fix by using correctAnswer field
      choices.forEach(c => {
        c.isCorrect = c.label === raw.correctAnswer;
      });
    }

    return {
      stem: raw.stem || '',
      choices,
      correctAnswer: raw.correctAnswer || 'A',
      explanation: raw.explanation || '',
      fastestMethod: raw.fastestMethod || '',
      trapNotes: raw.trapNotes || null,
      estimatedDifficulty: raw.estimatedDifficulty || request.targetDifficulty,
      timeBudgetSeconds: raw.timeBudgetSeconds || 120,
      generationId,
      model: this.client.getModel(),
      promptTokens: 0, // Set by caller
      completionTokens: 0, // Set by caller
    };
  }
}

// ============================================
// Raw Response Type
// ============================================

interface RawGeneratedQuestion {
  stem?: string;
  choices?: Array<{
    label?: string;
    text?: string;
    isCorrect?: boolean;
    trapType?: string | null;
  }>;
  correctAnswer?: string;
  explanation?: string;
  fastestMethod?: string;
  trapNotes?: string | null;
  estimatedDifficulty?: number;
  timeBudgetSeconds?: number;
  
  // DS-specific
  statement1?: string;
  statement2?: string;
  
  // RC-specific
  passage?: {
    text?: string;
    wordCount?: number;
    topic?: string;
    structure?: string;
  };
  questionSubtype?: string;
}

// ============================================
// Singleton Instance
// ============================================

let generatorInstance: QuestionGenerator | null = null;

export function getQuestionGenerator(): QuestionGenerator {
  if (!generatorInstance) {
    generatorInstance = new QuestionGenerator();
  }
  return generatorInstance;
}

export function resetQuestionGenerator(): void {
  generatorInstance = null;
}
