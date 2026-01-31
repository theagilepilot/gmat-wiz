/**
 * Question Validator Pipeline
 * Validates AI-generated questions for quality and correctness
 */

import type {
  GeneratedQuestion,
  ValidationResult,
  ValidationIssue,
  ValidationIssueType,
  GMATSection,
  QuestionTypeCode,
} from './types.js';

// ============================================
// Validator Interface
// ============================================

interface Validator {
  name: string;
  validate(question: GeneratedQuestion, context: ValidationContext): ValidationIssue[];
}

interface ValidationContext {
  section: GMATSection;
  questionType: QuestionTypeCode;
  targetDifficulty: number;
}

// ============================================
// Answer Validator
// ============================================

const answerValidator: Validator = {
  name: 'AnswerValidator',
  
  validate(question: GeneratedQuestion): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for exactly one correct answer
    const correctChoices = question.choices.filter(c => c.isCorrect);
    
    if (correctChoices.length === 0) {
      issues.push({
        type: 'no_correct_answer',
        severity: 'error',
        message: 'No correct answer marked in choices',
        field: 'choices',
      });
    } else if (correctChoices.length > 1) {
      issues.push({
        type: 'multiple_correct',
        severity: 'error',
        message: `Multiple correct answers marked: ${correctChoices.map(c => c.label).join(', ')}`,
        field: 'choices',
      });
    }

    // Check correctAnswer field matches
    const markedCorrect = question.choices.find(c => c.isCorrect);
    if (markedCorrect && markedCorrect.label !== question.correctAnswer) {
      issues.push({
        type: 'ambiguous_answer',
        severity: 'error',
        message: `Correct answer field (${question.correctAnswer}) doesn't match marked choice (${markedCorrect.label})`,
        field: 'correctAnswer',
      });
    }

    // Check for 5 choices (standard GMAT)
    if (question.choices.length !== 5) {
      issues.push({
        type: 'formatting_issue',
        severity: 'warning',
        message: `Expected 5 choices, got ${question.choices.length}`,
        field: 'choices',
      });
    }

    // Check choice labels are A-E
    const expectedLabels = ['A', 'B', 'C', 'D', 'E'];
    const actualLabels = question.choices.map(c => c.label);
    const missingLabels = expectedLabels.filter(l => !actualLabels.includes(l));
    
    if (missingLabels.length > 0 && question.choices.length === 5) {
      issues.push({
        type: 'formatting_issue',
        severity: 'warning',
        message: `Non-standard choice labels: ${actualLabels.join(', ')}`,
        field: 'choices',
      });
    }

    return issues;
  },
};

// ============================================
// Distractor Validator
// ============================================

const distractorValidator: Validator = {
  name: 'DistractorValidator',
  
  validate(question: GeneratedQuestion): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const incorrectChoices = question.choices.filter(c => !c.isCorrect);

    // Check distractors have content
    for (const choice of incorrectChoices) {
      if (!choice.text || choice.text.trim().length < 2) {
        issues.push({
          type: 'weak_distractors',
          severity: 'error',
          message: `Choice ${choice.label} has empty or very short text`,
          field: `choices.${choice.label}`,
        });
      }
    }

    // Check for duplicate distractor text
    const texts = incorrectChoices.map(c => c.text.toLowerCase().trim());
    const uniqueTexts = new Set(texts);
    
    if (uniqueTexts.size < texts.length) {
      issues.push({
        type: 'weak_distractors',
        severity: 'error',
        message: 'Duplicate distractor text detected',
        field: 'choices',
      });
    }

    // Check trap types are specified for medium+ difficulty
    const trapCount = incorrectChoices.filter(c => c.trapType).length;
    if (trapCount === 0) {
      issues.push({
        type: 'weak_distractors',
        severity: 'info',
        message: 'No trap types specified for distractors',
        field: 'choices',
      });
    }

    return issues;
  },
};

// ============================================
// Difficulty Validator
// ============================================

const difficultyValidator: Validator = {
  name: 'DifficultyValidator',
  
  validate(question: GeneratedQuestion, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const diff = Math.abs(question.estimatedDifficulty - context.targetDifficulty);

    if (diff > 100) {
      issues.push({
        type: 'difficulty_mismatch',
        severity: 'warning',
        message: `Estimated difficulty (${question.estimatedDifficulty}) differs significantly from target (${context.targetDifficulty})`,
        field: 'estimatedDifficulty',
      });
    } else if (diff > 50) {
      issues.push({
        type: 'difficulty_mismatch',
        severity: 'info',
        message: `Estimated difficulty (${question.estimatedDifficulty}) differs from target (${context.targetDifficulty})`,
        field: 'estimatedDifficulty',
      });
    }

    // Check difficulty is in valid range
    if (question.estimatedDifficulty < 200 || question.estimatedDifficulty > 800) {
      issues.push({
        type: 'difficulty_mismatch',
        severity: 'error',
        message: `Difficulty ${question.estimatedDifficulty} is outside valid range (200-800)`,
        field: 'estimatedDifficulty',
      });
    }

    return issues;
  },
};

// ============================================
// Timing Validator
// ============================================

const timingValidator: Validator = {
  name: 'TimingValidator',
  
  validate(question: GeneratedQuestion, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const expectedTimes: Record<string, { min: number; max: number }> = {
      problem_solving: { min: 60, max: 180 },
      data_sufficiency: { min: 60, max: 180 },
      sentence_correction: { min: 45, max: 120 },
      critical_reasoning: { min: 60, max: 150 },
      reading_comprehension: { min: 60, max: 150 },
      graphics_interpretation: { min: 90, max: 180 },
      two_part_analysis: { min: 120, max: 240 },
      table_analysis: { min: 120, max: 240 },
      multi_source_reasoning: { min: 120, max: 240 },
      awa_essay: { min: 1500, max: 2100 },
    };

    const expected = expectedTimes[context.questionType];
    
    if (expected) {
      if (question.timeBudgetSeconds < expected.min) {
        issues.push({
          type: 'timing_issue',
          severity: 'warning',
          message: `Time budget (${question.timeBudgetSeconds}s) is below typical minimum (${expected.min}s)`,
          field: 'timeBudgetSeconds',
        });
      } else if (question.timeBudgetSeconds > expected.max) {
        issues.push({
          type: 'timing_issue',
          severity: 'warning',
          message: `Time budget (${question.timeBudgetSeconds}s) exceeds typical maximum (${expected.max}s)`,
          field: 'timeBudgetSeconds',
        });
      }
    }

    return issues;
  },
};

// ============================================
// Content Validator
// ============================================

const contentValidator: Validator = {
  name: 'ContentValidator',
  
  validate(question: GeneratedQuestion): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check stem is not empty
    if (!question.stem || question.stem.trim().length < 10) {
      issues.push({
        type: 'unclear_stem',
        severity: 'error',
        message: 'Question stem is missing or too short',
        field: 'stem',
      });
    }

    // Check explanation exists
    if (!question.explanation || question.explanation.trim().length < 20) {
      issues.push({
        type: 'missing_explanation',
        severity: 'warning',
        message: 'Explanation is missing or too short',
        field: 'explanation',
      });
    }

    // Check fastest method is specified
    if (!question.fastestMethod || question.fastestMethod.trim().length < 10) {
      issues.push({
        type: 'content_issue',
        severity: 'info',
        message: 'Fastest method description is missing or too short',
        field: 'fastestMethod',
      });
    }

    // Check for placeholder text
    const placeholderPatterns = [
      /\[.*?\]/g,
      /TODO/i,
      /PLACEHOLDER/i,
      /INSERT.*HERE/i,
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(question.stem)) {
        issues.push({
          type: 'content_issue',
          severity: 'error',
          message: 'Stem contains placeholder text',
          field: 'stem',
        });
        break;
      }
    }

    return issues;
  },
};

// ============================================
// Trap Notes Validator
// ============================================

const trapNotesValidator: Validator = {
  name: 'TrapNotesValidator',
  
  validate(question: GeneratedQuestion, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Trap notes recommended for medium+ difficulty
    if (context.targetDifficulty >= 550 && !question.trapNotes) {
      issues.push({
        type: 'missing_trap_notes',
        severity: 'info',
        message: 'Trap notes recommended for medium+ difficulty questions',
        field: 'trapNotes',
      });
    }

    return issues;
  },
};

// ============================================
// Validator Pipeline
// ============================================

const validators: Validator[] = [
  answerValidator,
  distractorValidator,
  difficultyValidator,
  timingValidator,
  contentValidator,
  trapNotesValidator,
];

export function validateQuestion(
  question: GeneratedQuestion,
  context: ValidationContext
): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  for (const validator of validators) {
    try {
      const issues = validator.validate(question, context);
      allIssues.push(...issues);
    } catch (error) {
      allIssues.push({
        type: 'content_issue',
        severity: 'error',
        message: `Validator ${validator.name} failed: ${(error as Error).message}`,
      });
    }
  }

  // Calculate score
  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  const score = Math.max(0, 100 - (errorCount * 30) - (warningCount * 10) - (infoCount * 2));

  // Generate suggestions
  const suggestions = generateSuggestions(allIssues);

  return {
    isValid: errorCount === 0,
    score,
    issues: allIssues,
    suggestions,
  };
}

function generateSuggestions(issues: ValidationIssue[]): string[] {
  const suggestions: string[] = [];

  const issueTypes = new Set(issues.map(i => i.type));

  if (issueTypes.has('no_correct_answer') || issueTypes.has('multiple_correct')) {
    suggestions.push('Review answer choices to ensure exactly one is marked correct');
  }

  if (issueTypes.has('weak_distractors')) {
    suggestions.push('Improve distractors with more plausible wrong answers that catch common errors');
  }

  if (issueTypes.has('difficulty_mismatch')) {
    suggestions.push('Adjust question complexity to better match target difficulty level');
  }

  if (issueTypes.has('missing_explanation')) {
    suggestions.push('Add a detailed step-by-step explanation');
  }

  if (issueTypes.has('timing_issue')) {
    suggestions.push('Review time budget to match question complexity');
  }

  return suggestions;
}

// ============================================
// Question Validator Class
// ============================================

export class QuestionValidator {
  validate(question: GeneratedQuestion, context: ValidationContext): ValidationResult {
    return validateQuestion(question, context);
  }

  validateBatch(
    questions: GeneratedQuestion[],
    context: ValidationContext
  ): ValidationResult[] {
    return questions.map(q => this.validate(q, context));
  }

  isPublishable(result: ValidationResult): boolean {
    return result.isValid && result.score >= 70;
  }
}

// ============================================
// Singleton
// ============================================

let validatorInstance: QuestionValidator | null = null;

export function getQuestionValidator(): QuestionValidator {
  if (!validatorInstance) {
    validatorInstance = new QuestionValidator();
  }
  return validatorInstance;
}
