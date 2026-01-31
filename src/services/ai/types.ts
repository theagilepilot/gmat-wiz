/**
 * AI Service Type Definitions
 * Types for question generation, validation, and AI interactions
 */

// ============================================
// Question Generation Types
// ============================================

export type GMATSection = 'quant' | 'verbal' | 'ir' | 'awa';

export type QuantQuestionType = 
  | 'problem_solving'
  | 'data_sufficiency';

export type VerbalQuestionType =
  | 'sentence_correction'
  | 'critical_reasoning'
  | 'reading_comprehension';

export type IRQuestionType =
  | 'graphics_interpretation'
  | 'two_part_analysis'
  | 'table_analysis'
  | 'multi_source_reasoning';

export type QuestionTypeCode = QuantQuestionType | VerbalQuestionType | IRQuestionType | 'awa_essay';

export interface GenerationRequest {
  section: GMATSection;
  questionType: QuestionTypeCode;
  targetDifficulty: number; // ELO rating 300-800
  targetAtomIds: number[];
  atomNames: string[]; // Human-readable atom names for prompt
  atomDescriptions: string[]; // Atom descriptions for context
  
  // Optional constraints
  trapArchetype?: string; // e.g., 'calculation_trap', 'misread_trap'
  methodHint?: string; // Preferred solving method
  timeBudgetSeconds?: number;
  avoidSimilarTo?: string[]; // Question stems to avoid duplicating
}

export interface GeneratedQuestion {
  stem: string;
  choices: QuestionChoice[];
  correctAnswer: string; // 'A', 'B', 'C', 'D', 'E' or answer text
  explanation: string;
  fastestMethod: string;
  trapNotes: string | null;
  estimatedDifficulty: number;
  timeBudgetSeconds: number;
  
  // Metadata
  generationId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface QuestionChoice {
  label: string; // 'A', 'B', 'C', 'D', 'E'
  text: string;
  isCorrect: boolean;
  trapType?: string; // Why this distractor might be chosen
}

// ============================================
// Data Sufficiency Specific
// ============================================

export interface DSQuestion extends GeneratedQuestion {
  statement1: string;
  statement2: string;
  // Choices are always:
  // A: Statement 1 alone sufficient
  // B: Statement 2 alone sufficient
  // C: Both together sufficient
  // D: Each alone sufficient
  // E: Neither sufficient
}

// ============================================
// Reading Comprehension Specific
// ============================================

export interface RCPassage {
  text: string;
  wordCount: number;
  topic: string;
  structure: string; // e.g., 'argument', 'compare_contrast', 'cause_effect'
}

export interface RCQuestion extends GeneratedQuestion {
  passage: RCPassage;
  questionSubtype: 'main_idea' | 'detail' | 'inference' | 'tone' | 'structure' | 'strengthen_weaken';
}

// ============================================
// AWA Specific
// ============================================

export interface AWAPrompt {
  argument: string;
  logicalFlaws: string[];
  suggestedStructure: string[];
  sampleOutline: string;
}

// ============================================
// Validation Types
// ============================================

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export type ValidationIssueType =
  | 'ambiguous_answer'
  | 'multiple_correct'
  | 'no_correct_answer'
  | 'weak_distractors'
  | 'difficulty_mismatch'
  | 'timing_issue'
  | 'missing_explanation'
  | 'missing_trap_notes'
  | 'unclear_stem'
  | 'formatting_issue'
  | 'content_issue';

// ============================================
// OpenAI API Types
// ============================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface CompletionResult {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

// ============================================
// Generation Pipeline Types
// ============================================

export interface GenerationPipelineResult {
  success: boolean;
  question: GeneratedQuestion | null;
  validation: ValidationResult | null;
  attempts: number;
  totalTokens: number;
  errors: string[];
}

export interface BatchGenerationRequest {
  requests: GenerationRequest[];
  maxConcurrent?: number;
  stopOnFirstFailure?: boolean;
}

export interface BatchGenerationResult {
  total: number;
  successful: number;
  failed: number;
  results: GenerationPipelineResult[];
  totalTokens: number;
}

// ============================================
// Question Pool Types
// ============================================

export type QuestionPoolStatus = 'pending' | 'validated' | 'rejected' | 'published';

export interface PooledQuestion {
  id: number;
  generatedQuestion: GeneratedQuestion;
  status: QuestionPoolStatus;
  validationResult: ValidationResult | null;
  createdAt: string;
  validatedAt: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
}

// ============================================
// Rate Limiting Types
// ============================================

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface RateLimitState {
  requestsThisMinute: number;
  tokensThisMinute: number;
  minuteStartTime: number;
  isLimited: boolean;
}
