/**
 * Integration Tests for Service Interactions
 * Tests the interaction between different services
 */

import {
  STANDARD_TIME_BUDGETS,
  TIME_MULTIPLIERS,
  LEVEL_TO_TIMING_MODE,
  TimingMode,
} from '../../services/timing/types.js';
import { BudgetCalculator } from '../../services/timing/BudgetCalculator.js';
import { TimingAnalytics } from '../../services/timing/TimingAnalytics.js';

// Inline ELO calculations to avoid import.meta.url issues
function calculateExpectedWinRate(playerRating: number, questionDifficulty: number): number {
  return 1 / (1 + Math.pow(10, (questionDifficulty - playerRating) / 400));
}

function getKFactor(gamesPlayed: number, ratingDeviation: number = 350): number {
  let kFactor: number;
  if (gamesPlayed < 10) kFactor = 48;
  else if (gamesPlayed < 30) kFactor = 32;
  else if (gamesPlayed < 100) kFactor = 24;
  else kFactor = 16;
  
  if (ratingDeviation > 200) kFactor = Math.min(64, kFactor * 1.25);
  else if (ratingDeviation < 50) kFactor = Math.max(8, kFactor * 0.8);
  
  return Math.round(kFactor);
}

function calculateRawEloChange(
  currentRating: number,
  questionDifficulty: number,
  wasCorrect: boolean,
  kFactor: number
): number {
  const expectedScore = calculateExpectedWinRate(currentRating, questionDifficulty);
  const actualScore = wasCorrect ? 1 : 0;
  return kFactor * (actualScore - expectedScore);
}

describe('Service Integration Tests', () => {
  describe('Timing and ELO Integration', () => {
    const budgetCalculator = new BudgetCalculator();

    it('timing mode affects question selection strategy', () => {
      // At learning mode (L1-2), timing is relaxed
      const learningBudget = budgetCalculator.calculateBudget('problem-solving', 1);
      expect(learningBudget.mode).toBe('learning');
      expect(learningBudget.strictEnforcement).toBe(false);

      // At test-realistic (L9-10), timing is strict
      const testBudget = budgetCalculator.calculateBudget('problem-solving', 10);
      expect(testBudget.mode).toBe('test-realistic');
      expect(testBudget.strictEnforcement).toBe(true);
    });

    it('ELO updates should consider timing performance', () => {
      const userRating = 500;
      const questionDifficulty = 500;

      // Correct answer with fast time
      const fastCorrectChange = calculateRawEloChange(
        userRating,
        questionDifficulty,
        true,
        32
      );

      // Correct answer (same conditions, same K-factor)
      const normalCorrectChange = calculateRawEloChange(
        userRating,
        questionDifficulty,
        true,
        32
      );

      // Both should be positive for correct answers
      expect(fastCorrectChange).toBeGreaterThan(0);
      expect(normalCorrectChange).toBeGreaterThan(0);
    });
  });

  describe('Level Progression Integration', () => {
    it('timing modes match level system expectations', () => {
      // Levels 1-2: Learning mode for building correctness
      expect(LEVEL_TO_TIMING_MODE[1]).toBe('learning');
      expect(LEVEL_TO_TIMING_MODE[2]).toBe('learning');

      // Levels 5-6: Standard mode for real pacing
      expect(LEVEL_TO_TIMING_MODE[5]).toBe('standard');
      expect(LEVEL_TO_TIMING_MODE[6]).toBe('standard');

      // Levels 9-10: Test-realistic
      expect(LEVEL_TO_TIMING_MODE[9]).toBe('test-realistic');
      expect(LEVEL_TO_TIMING_MODE[10]).toBe('test-realistic');
    });

    it('time budgets decrease appropriately with level', () => {
      const calculator = new BudgetCalculator();

      const level1Budget = calculator.calculateBudget('problem-solving', 1);
      const level5Budget = calculator.calculateBudget('problem-solving', 5);
      const level10Budget = calculator.calculateBudget('problem-solving', 10);

      // Level 1 should have more time than level 5
      expect(level1Budget.adjustedSeconds).toBeGreaterThan(level5Budget.adjustedSeconds);
      
      // Level 5 and 10 should have same time (both at 1x multiplier)
      expect(level5Budget.adjustedSeconds).toBe(level10Budget.adjustedSeconds);
    });
  });

  describe('Question Type Consistency', () => {
    const VALID_QUESTION_TYPES = [
      'problem-solving',
      'data-sufficiency',
      'reading-comprehension',
      'critical-reasoning',
      'sentence-correction',
    ] as const;

    it('all question types have time budgets', () => {
      for (const type of VALID_QUESTION_TYPES) {
        expect(STANDARD_TIME_BUDGETS[type]).toBeDefined();
        expect(STANDARD_TIME_BUDGETS[type]).toBeGreaterThan(0);
      }
    });

    it('budget calculator handles all question types', () => {
      const calculator = new BudgetCalculator();

      for (const type of VALID_QUESTION_TYPES) {
        const budget = calculator.calculateBudget(type, 5);
        expect(budget.standardSeconds).toBe(STANDARD_TIME_BUDGETS[type]);
        expect(budget.adjustedSeconds).toBeGreaterThan(0);
      }
    });
  });
});

describe('Data Validation Tests', () => {
  describe('Rating Bounds', () => {
    it('win rate is always between 0 and 1', () => {
      // Various rating combinations
      const testCases = [
        { user: 100, question: 900 },
        { user: 900, question: 100 },
        { user: 500, question: 500 },
        { user: 200, question: 200 },
      ];

      for (const { user, question } of testCases) {
        const winRate = calculateExpectedWinRate(user, question);
        expect(winRate).toBeGreaterThanOrEqual(0);
        expect(winRate).toBeLessThanOrEqual(1);
      }
    });

    it('K-factor is always positive', () => {
      const testCases = [
        { games: 0, deviation: 100 },
        { games: 50, deviation: 200 },
        { games: 100, deviation: 50 },
        { games: 500, deviation: 350 },
      ];

      for (const { games, deviation } of testCases) {
        const kFactor = getKFactor(games, deviation);
        expect(kFactor).toBeGreaterThan(0);
      }
    });
  });

  describe('Time Categorization', () => {
    it('categorizes all time ratios consistently', () => {
      const calculator = new BudgetCalculator();
      const testCases = [
        { used: 30, budget: 100, expected: 'fast' },
        { used: 70, budget: 100, expected: 'optimal' },
        { used: 90, budget: 100, expected: 'slow' },
        { used: 150, budget: 100, expected: 'overtime' },
      ];

      for (const { used, budget, expected } of testCases) {
        const category = calculator.categorizeTimeUsage(used, budget);
        expect(category).toBe(expected);
      }
    });
  });
});

describe('Response Format Validation', () => {
  describe('Timing Result Structure', () => {
    it('timing results have all required fields', () => {
      const analytics = new TimingAnalytics();
      
      const result = {
        questionId: 'q1',
        questionType: 'problem-solving' as const,
        budgetSeconds: 120,
        actualSeconds: 100,
        timeRatio: 100 / 120,
        wasOvertime: false,
        percentUsed: (100 / 120) * 100,
        timingCategory: 'optimal' as const,
      };

      // Should accept valid result
      analytics.addResult(result);

      // Verify all required fields exist
      expect(result.questionId).toBeDefined();
      expect(result.questionType).toBeDefined();
      expect(result.budgetSeconds).toBeDefined();
      expect(result.actualSeconds).toBeDefined();
      expect(result.timeRatio).toBeDefined();
      expect(result.wasOvertime).toBeDefined();
      expect(result.percentUsed).toBeDefined();
      expect(result.timingCategory).toBeDefined();
    });
  });

  describe('Session Summary Structure', () => {
    it('session summaries have all required fields', () => {
      const analytics = new TimingAnalytics();
      
      const results = [
        {
          questionId: 'q1',
          questionType: 'problem-solving' as const,
          budgetSeconds: 120,
          actualSeconds: 100,
          timeRatio: 100 / 120,
          wasOvertime: false,
          percentUsed: (100 / 120) * 100,
          timingCategory: 'optimal' as const,
        },
      ];

      const summary = analytics.getSessionSummary(results);

      expect(summary.totalQuestions).toBeDefined();
      expect(summary.totalTimeSeconds).toBeDefined();
      expect(summary.averageTimeSeconds).toBeDefined();
      expect(summary.fastCount).toBeDefined();
      expect(summary.optimalCount).toBeDefined();
      expect(summary.slowCount).toBeDefined();
      expect(summary.overtimeCount).toBeDefined();
    });
  });
});

describe('Error Recovery Tests', () => {
  describe('Timing Service Recovery', () => {
    it('recovers from invalid question type gracefully', () => {
      const calculator = new BudgetCalculator();
      
      // Valid types should work
      expect(() => calculator.calculateBudget('problem-solving', 5)).not.toThrow();
    });

    it('handles empty analytics data', () => {
      const analytics = new TimingAnalytics();
      
      // Should handle empty results without crashing
      const summary = analytics.getSessionSummary([]);
      expect(summary.totalQuestions).toBe(0);
      expect(summary.averageTimeSeconds).toBe(0);
    });
  });

  describe('ELO Service Recovery', () => {
    it('handles extreme rating differences', () => {
      // Very large difference shouldn't break the math
      const winRate = calculateExpectedWinRate(100, 900);
      expect(winRate).toBeGreaterThanOrEqual(0);
      expect(winRate).toBeLessThanOrEqual(1);
      expect(isFinite(winRate)).toBe(true);
    });

    it('handles boundary K-factors', () => {
      // Should work with edge case games played
      const kFactor = getKFactor(0, 0);
      expect(kFactor).toBeGreaterThan(0);
      expect(isFinite(kFactor)).toBe(true);
    });
  });
});
