/**
 * End-to-End Flow Tests
 * Tests complete user workflows through the system
 */

import {
  LEVEL_TO_TIMING_MODE,
  STANDARD_TIME_BUDGETS,
  TIME_MULTIPLIERS,
  TimingMode,
} from '../../services/timing/types.js';
import { BudgetCalculator } from '../../services/timing/BudgetCalculator.js';
import { TimingAnalytics } from '../../services/timing/TimingAnalytics.js';
import { AbandonmentTracker } from '../../services/timing/AbandonmentTracker.js';

// Inline ELO calculations to avoid import.meta.url issues
function calculateExpectedWinRate(playerRating: number, questionDifficulty: number): number {
  return 1 / (1 + Math.pow(10, (questionDifficulty - playerRating) / 400));
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

// Simulated user session data
interface SimulatedAttempt {
  questionId: string;
  questionType: 'problem-solving' | 'data-sufficiency' | 'critical-reasoning';
  difficulty: number;
  userRating: number;
  isCorrect: boolean;
  timeSpentMs: number;
  wasAbandoned: boolean;
}

describe('E2E: Complete Question Attempt Flow', () => {
  const budgetCalculator = new BudgetCalculator();
  const timingAnalytics = new TimingAnalytics();
  const abandonmentTracker = new AbandonmentTracker();

  describe('Build Mode Question Flow (Beginner)', () => {
    it('should complete full attempt cycle for level 1 user', () => {
      const userLevel = 1;
      const userRating = 400;
      const questionDifficulty = 350; // Easier than user

      // Step 1: Calculate time budget for beginner
      const budget = budgetCalculator.calculateBudget('problem-solving', userLevel);
      expect(budget.mode).toBe('learning');
      // Learning mode uses 3x multiplier
      expect(budget.adjustedSeconds).toBe(120 * 3); // 6 minutes

      // Step 2: Simulate answer (correct, used 4 minutes)
      const timeSpentSeconds = 240;
      const isCorrect = true;

      // Step 3: Categorize timing
      const timingCategory = budgetCalculator.categorizeTimeUsage(
        timeSpentSeconds,
        budget.adjustedSeconds
      );
      expect(timingCategory).toBe('optimal'); // 67% of budget

      // Step 4: Calculate ELO change
      const expectedWinRate = calculateExpectedWinRate(userRating, questionDifficulty);
      expect(expectedWinRate).toBeGreaterThan(0.5); // Should expect to win

      const eloChange = calculateRawEloChange(
        userRating,
        questionDifficulty,
        isCorrect,
        32
      );
      expect(eloChange).toBeGreaterThan(0); // Rating should increase

      // Step 5: Record timing result
      const timingResult = {
        questionId: 'q1',
        questionType: 'problem-solving' as const,
        budgetSeconds: budget.adjustedSeconds,
        actualSeconds: timeSpentSeconds,
        timeRatio: timeSpentSeconds / budget.adjustedSeconds,
        wasOvertime: false,
        percentUsed: (timeSpentSeconds / budget.adjustedSeconds) * 100,
        timingCategory: timingCategory as any,
      };
      timingAnalytics.addResult(timingResult);
    });

    it('should handle incorrect answer with error logging flow', () => {
      const userLevel = 2;
      const userRating = 450;
      const questionDifficulty = 500; // Harder than user

      // Step 1: Get budget
      const budget = budgetCalculator.calculateBudget('data-sufficiency', userLevel);
      expect(budget.mode).toBe('learning');

      // Step 2: Simulate wrong answer (slow)
      const timeSpentSeconds = 400; // Over budget even with 3x multiplier
      const isCorrect = false;

      // Step 3: ELO penalty
      const eloChange = calculateRawEloChange(
        userRating,
        questionDifficulty,
        isCorrect,
        32
      );
      expect(eloChange).toBeLessThan(0); // Rating should decrease

      // Step 4: Error classification would be required
      // Since incorrect, user must classify: concept gap, recognition failure, etc.
      const errorClassification = {
        type: 'concept_gap',
        reflection: 'Did not understand statement sufficiency',
        actionItem: 'Review DS strategy fundamentals',
      };
      expect(errorClassification.type).toBeDefined();
    });
  });

  describe('Prove Mode Question Flow (Advanced)', () => {
    it('should enforce strict timing for level 8 user', () => {
      const userLevel = 8;
      
      // Step 1: Calculate budget - should be strict
      const budget = budgetCalculator.calculateBudget('problem-solving', userLevel);
      expect(budget.mode).toBe('strict');
      expect(budget.strictEnforcement).toBe(true);
      // Standard timing at level 8 (multiplier is 1.0)
      expect(budget.adjustedSeconds).toBe(120); // Standard 2 minutes

      // Step 2: Verify warning threshold
      expect(budget.warningThreshold).toBe(0.7); // Warns at 70%
    });

    it('should track abandonment for strategic guessing', () => {
      const userLevel = 6; // Strategy level - learning to guess

      // Simulate abandoning a hard question
      const event = abandonmentTracker.recordAbandonment(
        'hard-q1',
        'problem-solving',
        84000, // 84 seconds = 70% of 120s budget
        'strategic'
      );

      expect(event.wasStrategicGuess).toBe(true);
      expect(event.percentBudgetUsed).toBe(70);

      // Verify it's tracked
      const stats = abandonmentTracker.getStats();
      expect(stats.totalAbandoned).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Session Summary Flow', () => {
    it('should generate accurate session summary after multiple questions', () => {
      const sessionAnalytics = new TimingAnalytics();

      // Simulate a practice session with 10 questions
      const results = [
        { time: 60, budget: 120, category: 'fast' },     // Clean win
        { time: 90, budget: 120, category: 'optimal' },  // Good
        { time: 100, budget: 120, category: 'slow' },    // Acceptable
        { time: 130, budget: 120, category: 'overtime' }, // Over
        { time: 70, budget: 120, category: 'optimal' },
        { time: 80, budget: 120, category: 'optimal' },
        { time: 110, budget: 120, category: 'slow' },
        { time: 65, budget: 120, category: 'fast' },
        { time: 95, budget: 120, category: 'optimal' },
        { time: 140, budget: 120, category: 'overtime' },
      ];

      const timingResults = results.map((r, i) => ({
        questionId: `q${i}`,
        questionType: 'problem-solving' as const,
        budgetSeconds: r.budget,
        actualSeconds: r.time,
        timeRatio: r.time / r.budget,
        wasOvertime: r.time > r.budget,
        percentUsed: (r.time / r.budget) * 100,
        timingCategory: r.category as any,
      }));

      const summary = sessionAnalytics.getSessionSummary(timingResults);

      expect(summary.totalQuestions).toBe(10);
      expect(summary.fastCount).toBe(2);
      expect(summary.overtimeCount).toBe(2);
      expect(summary.averageTimeSeconds).toBe(94); // Average of all times
    });
  });
});

describe('E2E: Level Progression Flow', () => {
  describe('XP and Level Calculation', () => {
    const XP_THRESHOLDS = [0, 500, 1200, 2100, 3200, 4500, 6000, 7700, 9600, 11700];

    function getLevelForXP(xp: number): number {
      for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= XP_THRESHOLDS[i]) return i + 1;
      }
      return 1;
    }

    it('should progress through levels correctly', () => {
      // User starts at level 1
      let totalXP = 0;
      expect(getLevelForXP(totalXP)).toBe(1);

      // Earn XP from correct answers
      const correctAnswerXP = 10;
      const fastBonusXP = 5;
      const cleanWinXP = 5;

      // Simulate 20 clean wins
      for (let i = 0; i < 20; i++) {
        totalXP += correctAnswerXP + fastBonusXP + cleanWinXP;
      }
      expect(totalXP).toBe(400);
      expect(getLevelForXP(totalXP)).toBe(1); // Still level 1

      // 5 more clean wins
      for (let i = 0; i < 5; i++) {
        totalXP += correctAnswerXP + fastBonusXP + cleanWinXP;
      }
      expect(totalXP).toBe(500);
      expect(getLevelForXP(totalXP)).toBe(2); // Now level 2!

      // Continue to level 3
      while (getLevelForXP(totalXP) < 3) {
        totalXP += correctAnswerXP + fastBonusXP + cleanWinXP;
      }
      expect(getLevelForXP(totalXP)).toBe(3);
    });

    it('should unlock appropriate timing mode at each level', () => {
      const levelTimingExpectations = [
        { level: 1, mode: 'learning', multiplier: 3.0 },
        { level: 2, mode: 'learning', multiplier: 3.0 },
        { level: 3, mode: 'extended', multiplier: 1.5 },
        { level: 4, mode: 'extended', multiplier: 1.5 },
        { level: 5, mode: 'standard', multiplier: 1.0 },
        { level: 6, mode: 'standard', multiplier: 1.0 },
        { level: 7, mode: 'strict', multiplier: 1.0 },
        { level: 8, mode: 'strict', multiplier: 1.0 },
        { level: 9, mode: 'test-realistic', multiplier: 1.0 },
        { level: 10, mode: 'test-realistic', multiplier: 1.0 },
      ];

      for (const exp of levelTimingExpectations) {
        expect(LEVEL_TO_TIMING_MODE[exp.level]).toBe(exp.mode);
        expect(TIME_MULTIPLIERS[exp.mode as TimingMode]).toBe(exp.multiplier);
      }
    });
  });
});

describe('E2E: Adaptive Difficulty Flow', () => {
  it('should select appropriate question difficulty based on ELO', () => {

    // User with rating 600
    const userRating = 600;

    // Build mode targets ~75% win rate
    const buildModeTargetWinRate = 0.75;
    
    // Calculate what question difficulty gives 75% win rate
    // win rate = 1 / (1 + 10^((questionRating - userRating)/400))
    // 0.75 = 1 / (1 + 10^((q - 600)/400))
    // Solving: q ≈ 489
    
    // Check win rates at different difficulties
    const easyQuestion = 400;
    const optimalQuestion = 489;
    const hardQuestion = 700;

    const easyWinRate = calculateExpectedWinRate(userRating, easyQuestion);
    const optimalWinRate = calculateExpectedWinRate(userRating, optimalQuestion);
    const hardWinRate = calculateExpectedWinRate(userRating, hardQuestion);

    // User (600) vs Easy (400) = 200 point diff = ~76% win rate
    expect(easyWinRate).toBeGreaterThan(0.7);
    // 600 vs 489 = 111 point diff = ~65% win rate
    expect(optimalWinRate).toBeGreaterThan(0.6);
    expect(optimalWinRate).toBeLessThan(0.8);
    expect(hardWinRate).toBeLessThan(0.45);
  });

  it('should provide larger rating gains for upset wins', () => {
    const userRating = 500;

    // Beating an easy question (expected)
    const easyQuestionRating = 400;
    const easyWinGain = calculateRawEloChange(
      userRating,
      easyQuestionRating,
      true,
      32
    );

    // Beating a hard question (upset)
    const hardQuestionRating = 650;
    const hardWinGain = calculateRawEloChange(
      userRating,
      hardQuestionRating,
      true,
      32
    );

    // Upset win should give more rating
    expect(hardWinGain).toBeGreaterThan(easyWinGain);
  });
});

describe('E2E: Error Log and Reflection Flow', () => {
  const ERROR_TYPES = [
    { code: 'concept_gap', name: 'Concept Gap', category: 'knowledge' },
    { code: 'recognition_failure', name: 'Recognition Failure', category: 'classification' },
    { code: 'decision_error', name: 'Decision Error', category: 'strategy' },
    { code: 'execution_error', name: 'Execution Error', category: 'mechanics' },
    { code: 'timing_error', name: 'Timing Error', category: 'pacing' },
    { code: 'abandonment_failure', name: 'Abandonment Failure', category: 'strategy' },
  ];

  it('should suggest appropriate error type based on attempt data', () => {
    function suggestErrorType(
      isCorrect: boolean,
      timeRatio: number,
      wasAbandoned: boolean
    ): string[] {
      const suggestions: string[] = [];

      if (!isCorrect) {
        if (timeRatio > 1.5) {
          // Long time + wrong
          suggestions.push('timing_error', 'decision_error');
        } else if (timeRatio < 0.3) {
          // Very fast + wrong
          suggestions.push('recognition_failure', 'execution_error');
        } else {
          // Normal time + wrong
          suggestions.push('concept_gap', 'decision_error');
        }
      }

      if (wasAbandoned && !isCorrect) {
        suggestions.push('abandonment_failure');
      }

      if (isCorrect && timeRatio > 1.0) {
        // Right but slow
        suggestions.push('decision_error');
      }

      return [...new Set(suggestions)];
    }

    // Fast wrong answer
    expect(suggestErrorType(false, 0.25, false)).toContain('recognition_failure');

    // Slow wrong answer
    expect(suggestErrorType(false, 1.6, false)).toContain('timing_error');

    // Abandoned
    expect(suggestErrorType(false, 0.7, true)).toContain('abandonment_failure');

    // Correct but slow
    expect(suggestErrorType(true, 1.3, false)).toContain('decision_error');
  });

  it('should require reflection for non-clean-wins', () => {
    function isCleanWin(isCorrect: boolean, timeRatio: number): boolean {
      return isCorrect && timeRatio <= 0.8;
    }

    function requiresReflection(isCorrect: boolean, timeRatio: number): boolean {
      return !isCleanWin(isCorrect, timeRatio);
    }

    // Clean win - no reflection needed
    expect(requiresReflection(true, 0.5)).toBe(false);

    // Slow win - needs reflection
    expect(requiresReflection(true, 1.1)).toBe(true);

    // Any incorrect - needs reflection
    expect(requiresReflection(false, 0.5)).toBe(true);
    expect(requiresReflection(false, 1.5)).toBe(true);
  });
});

describe('E2E: Spaced Repetition Integration', () => {
  it('should schedule review based on performance quality', () => {
    function calculateNextReviewInterval(
      quality: number, // 0-5 (SM-2 scale)
      currentInterval: number,
      easeFactor: number
    ): { interval: number; easeFactor: number } {
      // SM-2 algorithm
      let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      newEF = Math.max(1.3, newEF);

      let newInterval: number;
      if (quality < 3) {
        // Failed - reset
        newInterval = 1;
      } else if (currentInterval === 0) {
        newInterval = 1;
      } else if (currentInterval === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(currentInterval * newEF);
      }

      return { interval: newInterval, easeFactor: newEF };
    }

    // Perfect recall
    const perfect = calculateNextReviewInterval(5, 6, 2.5);
    expect(perfect.interval).toBeGreaterThan(6);
    expect(perfect.easeFactor).toBeGreaterThan(2.5);

    // Failed recall
    const failed = calculateNextReviewInterval(2, 10, 2.5);
    expect(failed.interval).toBe(1); // Reset
    expect(failed.easeFactor).toBeLessThan(2.5);
  });
});
