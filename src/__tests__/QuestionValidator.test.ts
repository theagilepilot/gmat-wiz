/**
 * Question Validator Tests
 * Tests for AI-generated question validation
 */

import { validateQuestion } from '../services/ai/QuestionValidator.js';
import type { GeneratedQuestion, GMATSection, QuestionTypeCode } from '../services/ai/types.js';

describe('Question Validator', () => {
  const createValidQuestion = (): GeneratedQuestion => ({
    stem: 'If x + y = 10 and x - y = 4, what is the value of x?',
    choices: [
      { label: 'A', text: 'The value is 3', isCorrect: false, trapType: 'partial_answer' },
      { label: 'B', text: 'The value is 5', isCorrect: false },
      { label: 'C', text: 'The value is 7', isCorrect: true },
      { label: 'D', text: 'The value is 10', isCorrect: false },
      { label: 'E', text: 'The value is 14', isCorrect: false },
    ],
    correctAnswer: 'C',
    explanation: 'Adding the equations: 2x = 14, so x = 7. The answer is C.',
    fastestMethod: 'Add the two equations to eliminate y',
    trapNotes: 'Choice A (3) is the value of y, not x',
    estimatedDifficulty: 500,
    timeBudgetSeconds: 120,
    generationId: 'test-123',
    model: 'gpt-4',
    promptTokens: 100,
    completionTokens: 200,
  });

  const defaultContext = {
    section: 'quant' as GMATSection,
    questionType: 'problem_solving' as QuestionTypeCode,
    targetDifficulty: 500,
  };

  describe('Answer Validation', () => {
    it('accepts question with exactly one correct answer', () => {
      const question = createValidQuestion();
      const result = validateQuestion(question, defaultContext);

      expect(result.isValid).toBe(true);
      expect(result.issues.filter(i => i.type === 'no_correct_answer')).toHaveLength(0);
      expect(result.issues.filter(i => i.type === 'multiple_correct')).toHaveLength(0);
    });

    it('rejects question with no correct answer', () => {
      const question = createValidQuestion();
      question.choices.forEach(c => c.isCorrect = false);

      const result = validateQuestion(question, defaultContext);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'no_correct_answer')).toBe(true);
    });

    it('rejects question with multiple correct answers', () => {
      const question = createValidQuestion();
      question.choices[0].isCorrect = true;
      question.choices[2].isCorrect = true;

      const result = validateQuestion(question, defaultContext);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'multiple_correct')).toBe(true);
    });

    it('flags mismatch between correctAnswer field and marked choice', () => {
      const question = createValidQuestion();
      question.correctAnswer = 'A'; // But C is marked correct

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'ambiguous_answer')).toBe(true);
    });
  });

  describe('Distractor Validation', () => {
    it('accepts well-formed distractors', () => {
      const question = createValidQuestion();
      const result = validateQuestion(question, defaultContext);

      const distractorIssues = result.issues.filter(i => i.type === 'weak_distractors' && i.severity === 'error');
      expect(distractorIssues).toHaveLength(0);
    });

    it('flags empty distractor text', () => {
      const question = createValidQuestion();
      question.choices[0].text = '';

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'weak_distractors' && i.severity === 'error')).toBe(true);
    });

    it('flags duplicate distractors', () => {
      const question = createValidQuestion();
      question.choices[0].text = question.choices[1].text;

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'weak_distractors' && i.message.includes('Duplicate'))).toBe(true);
    });
  });

  describe('Difficulty Validation', () => {
    it('accepts difficulty within 100 points of target', () => {
      const question = createValidQuestion();
      question.estimatedDifficulty = 550;

      const result = validateQuestion(question, { ...defaultContext, targetDifficulty: 500 });

      const difficultyErrors = result.issues.filter(i => i.type === 'difficulty_mismatch' && i.severity === 'error');
      expect(difficultyErrors).toHaveLength(0);
    });

    it('warns when difficulty differs by more than 100 points', () => {
      const question = createValidQuestion();
      question.estimatedDifficulty = 650;

      const result = validateQuestion(question, { ...defaultContext, targetDifficulty: 500 });

      expect(result.issues.some(i => i.type === 'difficulty_mismatch' && i.severity === 'warning')).toBe(true);
    });

    it('errors on invalid difficulty range', () => {
      const question = createValidQuestion();
      question.estimatedDifficulty = 900;

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'difficulty_mismatch' && i.severity === 'error')).toBe(true);
    });
  });

  describe('Timing Validation', () => {
    it('accepts standard timing for problem solving', () => {
      const question = createValidQuestion();
      question.timeBudgetSeconds = 120;

      const result = validateQuestion(question, defaultContext);

      const timingIssues = result.issues.filter(i => i.type === 'timing_issue');
      expect(timingIssues).toHaveLength(0);
    });

    it('warns on very short timing', () => {
      const question = createValidQuestion();
      question.timeBudgetSeconds = 30;

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'timing_issue')).toBe(true);
    });

    it('warns on very long timing', () => {
      const question = createValidQuestion();
      question.timeBudgetSeconds = 300;

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'timing_issue')).toBe(true);
    });
  });

  describe('Content Validation', () => {
    it('flags missing or short stem', () => {
      const question = createValidQuestion();
      question.stem = 'Short';

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'unclear_stem')).toBe(true);
    });

    it('flags missing explanation', () => {
      const question = createValidQuestion();
      question.explanation = '';

      const result = validateQuestion(question, defaultContext);

      expect(result.issues.some(i => i.type === 'missing_explanation')).toBe(true);
    });
  });

  describe('Scoring', () => {
    it('gives high score to valid question', () => {
      const question = createValidQuestion();
      const result = validateQuestion(question, defaultContext);

      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('reduces score for errors', () => {
      const question = createValidQuestion();
      question.choices.forEach(c => c.isCorrect = false);

      const result = validateQuestion(question, defaultContext);

      expect(result.score).toBeLessThan(80);
    });

    it('generates suggestions for issues', () => {
      const question = createValidQuestion();
      question.explanation = '';

      const result = validateQuestion(question, defaultContext);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
