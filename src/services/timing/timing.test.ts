/**
 * Tests for Timing System
 */

import {
  STANDARD_TIME_BUDGETS,
  TIME_MULTIPLIERS,
  WARNING_THRESHOLDS,
  LEVEL_TO_TIMING_MODE,
  TimingResult,
  TimedQuestionType
} from '../timing/types.js';
import { BudgetCalculator } from '../timing/BudgetCalculator.js';
import { TimingAnalytics } from '../timing/TimingAnalytics.js';
import { DriftDetector } from '../timing/DriftDetector.js';
import { AbandonmentTracker, AbandonmentPattern } from '../timing/AbandonmentTracker.js';

describe('Timing Constants', () => {
  describe('Standard Time Budgets', () => {
    it('should have budgets for all question types', () => {
      const questionTypes: TimedQuestionType[] = [
        'problem-solving',
        'data-sufficiency',
        'reading-comprehension',
        'critical-reasoning',
        'sentence-correction',
        'multi-source-reasoning',
        'table-analysis',
        'graphics-interpretation',
        'two-part-analysis'
      ];

      for (const type of questionTypes) {
        expect(STANDARD_TIME_BUDGETS[type]).toBeDefined();
        expect(STANDARD_TIME_BUDGETS[type]).toBeGreaterThan(0);
      }
    });

    it('should have reasonable time budgets (1-3 minutes)', () => {
      for (const budget of Object.values(STANDARD_TIME_BUDGETS)) {
        expect(budget).toBeGreaterThanOrEqual(60);  // At least 1 minute
        expect(budget).toBeLessThanOrEqual(180);    // At most 3 minutes
      }
    });
  });

  describe('Time Multipliers', () => {
    it('should have learning mode at 3x', () => {
      expect(TIME_MULTIPLIERS['learning']).toBe(3.0);
    });

    it('should have extended mode at 1.5x', () => {
      expect(TIME_MULTIPLIERS['extended']).toBe(1.5);
    });

    it('should have standard/strict/test-realistic at 1x', () => {
      expect(TIME_MULTIPLIERS['standard']).toBe(1.0);
      expect(TIME_MULTIPLIERS['strict']).toBe(1.0);
      expect(TIME_MULTIPLIERS['test-realistic']).toBe(1.0);
    });
  });

  describe('Level to Timing Mode Mapping', () => {
    it('should map levels 1-2 to learning mode', () => {
      expect(LEVEL_TO_TIMING_MODE[1]).toBe('learning');
      expect(LEVEL_TO_TIMING_MODE[2]).toBe('learning');
    });

    it('should map levels 3-4 to extended mode', () => {
      expect(LEVEL_TO_TIMING_MODE[3]).toBe('extended');
      expect(LEVEL_TO_TIMING_MODE[4]).toBe('extended');
    });

    it('should map levels 5-6 to standard mode', () => {
      expect(LEVEL_TO_TIMING_MODE[5]).toBe('standard');
      expect(LEVEL_TO_TIMING_MODE[6]).toBe('standard');
    });

    it('should map levels 7-8 to strict mode', () => {
      expect(LEVEL_TO_TIMING_MODE[7]).toBe('strict');
      expect(LEVEL_TO_TIMING_MODE[8]).toBe('strict');
    });

    it('should map levels 9-10 to test-realistic mode', () => {
      expect(LEVEL_TO_TIMING_MODE[9]).toBe('test-realistic');
      expect(LEVEL_TO_TIMING_MODE[10]).toBe('test-realistic');
    });
  });

  describe('Warning Thresholds', () => {
    it('should have no warnings for learning mode', () => {
      expect(WARNING_THRESHOLDS['learning']).toBe(1.0);
    });

    it('should get stricter as modes progress', () => {
      expect(WARNING_THRESHOLDS['extended']).toBeLessThan(WARNING_THRESHOLDS['learning']);
      expect(WARNING_THRESHOLDS['standard']).toBeLessThan(WARNING_THRESHOLDS['extended']);
      expect(WARNING_THRESHOLDS['strict']).toBeLessThan(WARNING_THRESHOLDS['standard']);
      expect(WARNING_THRESHOLDS['test-realistic']).toBeLessThan(WARNING_THRESHOLDS['strict']);
    });
  });
});

describe('BudgetCalculator', () => {
  let calculator: BudgetCalculator;

  beforeEach(() => {
    calculator = new BudgetCalculator();
  });

  describe('getTimingMode', () => {
    it('should return correct mode for each level', () => {
      expect(calculator.getTimingMode(1)).toBe('learning');
      expect(calculator.getTimingMode(5)).toBe('standard');
      expect(calculator.getTimingMode(9)).toBe('test-realistic');
    });

    it('should clamp invalid levels', () => {
      expect(calculator.getTimingMode(0)).toBe('learning');
      expect(calculator.getTimingMode(15)).toBe('test-realistic');
    });
  });

  describe('calculateBudget', () => {
    it('should apply learning multiplier for level 1', () => {
      const budget = calculator.calculateBudget('problem-solving', 1);
      expect(budget.adjustedSeconds).toBe(STANDARD_TIME_BUDGETS['problem-solving'] * 3);
    });

    it('should apply extended multiplier for level 4', () => {
      const budget = calculator.calculateBudget('problem-solving', 4);
      expect(budget.adjustedSeconds).toBe(STANDARD_TIME_BUDGETS['problem-solving'] * 1.5);
    });

    it('should apply standard timing for level 6', () => {
      const budget = calculator.calculateBudget('problem-solving', 6);
      expect(budget.adjustedSeconds).toBe(STANDARD_TIME_BUDGETS['problem-solving']);
    });

    it('should include strict enforcement for levels 7+', () => {
      const level6Budget = calculator.calculateBudget('problem-solving', 6);
      const level7Budget = calculator.calculateBudget('problem-solving', 7);

      expect(level6Budget.strictEnforcement).toBe(false);
      expect(level7Budget.strictEnforcement).toBe(true);
    });

    it('should support custom multiplier', () => {
      const budget = calculator.calculateBudget('problem-solving', 6, 2.0);
      expect(budget.adjustedSeconds).toBe(STANDARD_TIME_BUDGETS['problem-solving'] * 2);
    });
  });

  describe('categorizeTimeUsage', () => {
    it('should categorize < 60% as fast', () => {
      expect(calculator.categorizeTimeUsage(50, 100)).toBe('fast');
    });

    it('should categorize 60-80% as optimal', () => {
      expect(calculator.categorizeTimeUsage(70, 100)).toBe('optimal');
    });

    it('should categorize 80-100% as slow', () => {
      expect(calculator.categorizeTimeUsage(90, 100)).toBe('slow');
    });

    it('should categorize > 100% as overtime', () => {
      expect(calculator.categorizeTimeUsage(120, 100)).toBe('overtime');
    });
  });
});

describe('TimingAnalytics', () => {
  let analytics: TimingAnalytics;

  const createResult = (
    type: TimedQuestionType,
    actualSeconds: number,
    budgetSeconds: number
  ): TimingResult => ({
    questionId: `q-${Math.random()}`,
    questionType: type,
    budgetSeconds,
    actualSeconds,
    timeRatio: actualSeconds / budgetSeconds,
    wasOvertime: actualSeconds > budgetSeconds,
    percentUsed: (actualSeconds / budgetSeconds) * 100,
    timingCategory: actualSeconds > budgetSeconds ? 'overtime' :
      actualSeconds > budgetSeconds * 0.8 ? 'slow' :
      actualSeconds < budgetSeconds * 0.6 ? 'fast' : 'optimal'
  });

  beforeEach(() => {
    analytics = new TimingAnalytics();
  });

  describe('getStatsByType', () => {
    it('should return null with insufficient samples', () => {
      analytics.addResult(createResult('problem-solving', 100, 120));
      analytics.addResult(createResult('problem-solving', 110, 120));
      
      expect(analytics.getStatsByType('problem-solving')).toBeNull();
    });

    it('should calculate stats with enough samples', () => {
      for (let i = 0; i < 10; i++) {
        analytics.addResult(createResult('problem-solving', 90 + i * 5, 120));
      }

      const stats = analytics.getStatsByType('problem-solving');
      expect(stats).not.toBeNull();
      expect(stats!.sampleCount).toBe(10);
      expect(stats!.meanSeconds).toBeGreaterThan(0);
      expect(stats!.medianSeconds).toBeGreaterThan(0);
    });
  });

  describe('getSessionSummary', () => {
    it('should summarize session timing', () => {
      const results = [
        createResult('problem-solving', 60, 120),  // fast
        createResult('problem-solving', 90, 120),  // optimal
        createResult('problem-solving', 100, 120), // slow
        createResult('problem-solving', 150, 120)  // overtime
      ];

      const summary = analytics.getSessionSummary(results);

      expect(summary.totalQuestions).toBe(4);
      expect(summary.fastCount).toBe(1);
      expect(summary.optimalCount).toBe(1);
      expect(summary.slowCount).toBe(1);
      expect(summary.overtimeCount).toBe(1);
    });

    it('should calculate average time correctly', () => {
      const results = [
        createResult('problem-solving', 100, 120),
        createResult('problem-solving', 120, 120),
        createResult('problem-solving', 80, 120)
      ];

      const summary = analytics.getSessionSummary(results);
      expect(summary.averageTimeSeconds).toBe(100);
    });
  });

  describe('detectDrift', () => {
    it('should not detect drift with insufficient data', () => {
      const results = [
        createResult('problem-solving', 100, 120),
        createResult('problem-solving', 105, 120)
      ];

      const drift = analytics.detectDrift(results);
      expect(drift.detected).toBe(false);
    });

    it('should detect drift when later questions take longer', () => {
      const results: TimingResult[] = [];
      
      // First half: fast
      for (let i = 0; i < 10; i++) {
        results.push(createResult('problem-solving', 80, 120));
      }
      
      // Second half: slow
      for (let i = 0; i < 10; i++) {
        results.push(createResult('problem-solving', 130, 120));
      }

      const drift = analytics.detectDrift(results);
      expect(drift.detected).toBe(true);
    });
  });
});

describe('DriftDetector', () => {
  let detector: DriftDetector;

  const createResult = (timeRatio: number): TimingResult => ({
    questionId: `q-${Math.random()}`,
    questionType: 'problem-solving',
    budgetSeconds: 120,
    actualSeconds: 120 * timeRatio,
    timeRatio,
    wasOvertime: timeRatio > 1,
    percentUsed: timeRatio * 100,
    timingCategory: 'optimal'
  });

  beforeEach(() => {
    detector = new DriftDetector(5);
  });

  describe('analyze', () => {
    it('should report no drift when pacing is consistent', () => {
      const results = Array(20).fill(null).map(() => createResult(0.8));
      
      const analysis = detector.analyze(results);
      expect(analysis.detected).toBe(false);
      expect(analysis.severity).toBe('none');
    });

    it('should detect mild drift', () => {
      const results = [
        ...Array(10).fill(null).map(() => createResult(0.7)),
        ...Array(10).fill(null).map(() => createResult(0.85))
      ];

      const analysis = detector.analyze(results);
      expect(analysis.detected).toBe(true);
      expect(analysis.severity).toBe('mild');
    });

    it('should detect severe drift', () => {
      const results = [
        ...Array(10).fill(null).map(() => createResult(0.6)),
        ...Array(10).fill(null).map(() => createResult(1.0))
      ];

      const analysis = detector.analyze(results);
      expect(analysis.detected).toBe(true);
      expect(analysis.severity).toBe('severe');
    });
  });

  describe('checkRealTimeDrift', () => {
    it('should warn when recent pace slows significantly', () => {
      const recent = [
        createResult(1.3),
        createResult(1.4),
        createResult(1.5)
      ];

      const result = detector.checkRealTimeDrift(recent, 0.8);
      expect(result.warning).toBe(true);
    });

    it('should not warn when pace is consistent', () => {
      const recent = [
        createResult(0.8),
        createResult(0.85),
        createResult(0.9)
      ];

      const result = detector.checkRealTimeDrift(recent, 0.85);
      expect(result.warning).toBe(false);
    });
  });
});

describe('AbandonmentTracker', () => {
  let tracker: AbandonmentTracker;

  beforeEach(() => {
    tracker = new AbandonmentTracker();
  });

  describe('recordAbandonment', () => {
    it('should record abandonment event', () => {
      const event = tracker.recordAbandonment(
        'q1',
        'problem-solving',
        90000, // 90 seconds
        'strategic'
      );

      expect(event.questionId).toBe('q1');
      expect(event.wasStrategicGuess).toBe(true);
    });

    it('should calculate percent budget used', () => {
      const event = tracker.recordAbandonment(
        'q1',
        'problem-solving',
        60000 // 60 seconds, budget is 120
      );

      expect(event.percentBudgetUsed).toBe(50);
    });

    it('should infer strategic guess when near budget', () => {
      const event = tracker.recordAbandonment(
        'q1',
        'problem-solving',
        90000 // 90 seconds = 75% of 120 budget
      );

      expect(event.wasStrategicGuess).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should calculate abandonment statistics', () => {
      tracker.recordAbandonment('q1', 'problem-solving', 90000, 'strategic');
      tracker.recordAbandonment('q2', 'problem-solving', 30000, 'gave-up');
      tracker.recordAbandonment('q3', 'data-sufficiency', 100000, 'strategic');

      const stats = tracker.getStats();

      expect(stats.totalAbandoned).toBe(3);
      expect(stats.strategicGuessRate).toBeCloseTo(2/3, 1);
      expect(stats.byQuestionType.get('problem-solving')?.count).toBe(2);
    });
  });

  describe('identifyPatterns', () => {
    it('should identify early abandonment pattern', () => {
      // Record several early abandons (< 30% of budget)
      tracker.recordAbandonment('q1', 'problem-solving', 20000); // ~17%
      tracker.recordAbandonment('q2', 'problem-solving', 25000); // ~21%
      tracker.recordAbandonment('q3', 'problem-solving', 30000); // ~25%

      const patterns = tracker.identifyPatterns();
      const earlyPattern = patterns.find((p: AbandonmentPattern) => p.type === 'early-abandon');

      expect(earlyPattern).toBeDefined();
    });

    it('should identify strategic pattern', () => {
      // Record strategic abandons (70-100% of budget)
      tracker.recordAbandonment('q1', 'problem-solving', 90000, 'strategic');
      tracker.recordAbandonment('q2', 'problem-solving', 100000, 'strategic');
      tracker.recordAbandonment('q3', 'problem-solving', 95000, 'strategic');

      const patterns = tracker.identifyPatterns();
      const strategicPattern = patterns.find((p: AbandonmentPattern) => p.type === 'strategic');

      expect(strategicPattern).toBeDefined();
    });
  });

  describe('getRecommendations', () => {
    it('should recommend more strategic guessing when rate is low', () => {
      // Record non-strategic abandons
      for (let i = 0; i < 6; i++) {
        tracker.recordAbandonment(`q${i}`, 'problem-solving', 30000, 'gave-up');
      }

      const recommendations = tracker.getRecommendations();
      expect(recommendations.some((r: string) => r.includes('strategic'))).toBe(true);
    });
  });
});
