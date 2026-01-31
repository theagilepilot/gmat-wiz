/**
 * Gate Evaluator Tests
 * Tests for mastery gate evaluation logic - pure functions
 */

import type { AccuracyRequirement, VolumeRequirement, StreakRequirement, GateProgress } from '../services/progression/types.js';

// Mock AtomMastery type (to avoid importing from models which pulls in DB)
interface MockAtomMastery {
  id: number;
  atom_id: number;
  mastery_level: string;
  attempts_total: number;
  attempts_correct: number;
  accuracy: number;
  recent_accuracy: number;
  recent_attempts: boolean[];
  avg_time_seconds: number | null;
  best_time_seconds: number | null;
  meets_accuracy_gate: boolean;
  meets_attempts_gate: boolean;
  meets_streak_gate: boolean;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
  mastered_at: string | null;
  created_at: string;
  updated_at: string;
}

// Re-implement pure evaluation functions for testing
function evaluateAccuracyRequirement(
  req: AccuracyRequirement,
  masteryData: MockAtomMastery[]
): GateProgress {
  const relevantMastery = req.atomIds && req.atomIds.length > 0
    ? masteryData.filter(m => req.atomIds!.includes(m.atom_id))
    : masteryData;
  
  if (relevantMastery.length === 0) {
    return {
      gateId: 0,
      gateType: 'accuracy',
      status: 'locked',
      currentValue: 0,
      requiredValue: req.threshold,
      percentComplete: 0,
      description: req.description,
      details: 'No attempts yet',
    };
  }
  
  const windowSize = req.windowSize ?? 0;
  let accuracy: number;
  let totalAttempts: number;
  
  if (windowSize > 0) {
    accuracy = relevantMastery.reduce((sum, m) => sum + m.recent_accuracy, 0) / relevantMastery.length;
    totalAttempts = relevantMastery.reduce((sum, m) => sum + m.recent_attempts.length, 0);
  } else {
    accuracy = relevantMastery.reduce((sum, m) => sum + m.accuracy, 0) / relevantMastery.length;
    totalAttempts = relevantMastery.reduce((sum, m) => sum + m.attempts_total, 0);
  }
  
  const minAttempts = req.minAttempts ?? 0;
  const hasEnoughAttempts = totalAttempts >= minAttempts;
  
  const passed = accuracy >= req.threshold && hasEnoughAttempts;
  const percentComplete = Math.min(100, (accuracy / req.threshold) * 100);
  
  let status: 'locked' | 'in_progress' | 'passed' | 'failed';
  if (passed) {
    status = 'passed';
  } else if (totalAttempts > 0) {
    status = 'in_progress';
  } else {
    status = 'locked';
  }
  
  return {
    gateId: 0,
    gateType: 'accuracy',
    status,
    currentValue: accuracy,
    requiredValue: req.threshold,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `${Math.round(accuracy * 100)}% accuracy on ${totalAttempts} attempts`,
  };
}

function evaluateVolumeRequirement(
  req: VolumeRequirement,
  masteryData: MockAtomMastery[]
): GateProgress {
  const totalAttempts = req.correctOnly
    ? masteryData.reduce((sum, m) => sum + m.attempts_correct, 0)
    : masteryData.reduce((sum, m) => sum + m.attempts_total, 0);
  
  const passed = totalAttempts >= req.threshold;
  const percentComplete = Math.min(100, (totalAttempts / req.threshold) * 100);
  
  return {
    gateId: 0,
    gateType: 'volume',
    status: passed ? 'passed' : (totalAttempts > 0 ? 'in_progress' : 'locked'),
    currentValue: totalAttempts,
    requiredValue: req.threshold,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `${totalAttempts} of ${req.threshold} ${req.correctOnly ? 'correct ' : ''}attempts`,
  };
}

function evaluateStreakRequirement(
  req: StreakRequirement,
  masteryData: MockAtomMastery[]
): GateProgress {
  let bestStreak = 0;
  
  for (const m of masteryData) {
    let streak = 0;
    for (let i = m.recent_attempts.length - 1; i >= 0 && m.recent_attempts[i]; i--) {
      streak++;
    }
    bestStreak = Math.max(bestStreak, streak);
  }
  
  const passed = bestStreak >= req.threshold;
  const percentComplete = Math.min(100, (bestStreak / req.threshold) * 100);
  
  return {
    gateId: 0,
    gateType: 'streak',
    status: passed ? 'passed' : (bestStreak > 0 ? 'in_progress' : 'locked'),
    currentValue: bestStreak,
    requiredValue: req.threshold,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `Best streak: ${bestStreak} of ${req.threshold}`,
  };
}

// Helper to create mock mastery data
function createMockMastery(overrides: Partial<MockAtomMastery> = {}): MockAtomMastery {
  return {
    id: 1,
    atom_id: 1,
    mastery_level: 'practicing',
    attempts_total: 20,
    attempts_correct: 17,
    accuracy: 0.85,
    recent_accuracy: 0.9,
    recent_attempts: [true, true, true, true, true, true, true, false, true, true],
    avg_time_seconds: 90,
    best_time_seconds: 60,
    meets_accuracy_gate: true,
    meets_attempts_gate: true,
    meets_streak_gate: false,
    first_attempt_at: '2024-01-01',
    last_attempt_at: '2024-01-15',
    mastered_at: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-15',
    ...overrides,
  };
}

describe('Gate Evaluator', () => {
  describe('evaluateAccuracyRequirement', () => {
    const baseReq: AccuracyRequirement = {
      type: 'accuracy',
      threshold: 0.85,
      description: '85% accuracy required',
    };

    it('passes when accuracy meets threshold', () => {
      const mastery = [createMockMastery({ accuracy: 0.90 })];
      const result = evaluateAccuracyRequirement(baseReq, mastery);
      
      expect(result.status).toBe('passed');
      expect(result.currentValue).toBeGreaterThanOrEqual(0.85);
    });

    it('fails when accuracy below threshold', () => {
      const mastery = [createMockMastery({ accuracy: 0.70 })];
      const result = evaluateAccuracyRequirement(baseReq, mastery);
      
      expect(result.status).toBe('in_progress');
      expect(result.currentValue).toBeLessThan(0.85);
    });

    it('returns locked when no attempts', () => {
      const result = evaluateAccuracyRequirement(baseReq, []);
      
      expect(result.status).toBe('locked');
      expect(result.percentComplete).toBe(0);
    });

    it('respects minAttempts requirement', () => {
      const reqWithMin: AccuracyRequirement = {
        ...baseReq,
        minAttempts: 50,
      };
      const mastery = [createMockMastery({ accuracy: 0.90, attempts_total: 20 })];
      const result = evaluateAccuracyRequirement(reqWithMin, mastery);
      
      // High accuracy but not enough attempts
      expect(result.status).toBe('in_progress');
    });

    it('uses recent accuracy when windowSize specified', () => {
      const reqWithWindow: AccuracyRequirement = {
        ...baseReq,
        windowSize: 10,
      };
      const mastery = [createMockMastery({ accuracy: 0.70, recent_accuracy: 0.90 })];
      const result = evaluateAccuracyRequirement(reqWithWindow, mastery);
      
      // Recent is good even though overall is bad
      expect(result.currentValue).toBeCloseTo(0.90, 1);
    });
  });

  describe('evaluateVolumeRequirement', () => {
    const baseReq: VolumeRequirement = {
      type: 'volume',
      threshold: 10,
      description: 'At least 10 attempts',
    };

    it('passes when volume meets threshold', () => {
      const mastery = [createMockMastery({ attempts_total: 15 })];
      const result = evaluateVolumeRequirement(baseReq, mastery);
      
      expect(result.status).toBe('passed');
      expect(result.currentValue).toBe(15);
    });

    it('fails when volume below threshold', () => {
      const mastery = [createMockMastery({ attempts_total: 5 })];
      const result = evaluateVolumeRequirement(baseReq, mastery);
      
      expect(result.status).toBe('in_progress');
      expect(result.percentComplete).toBe(50);
    });

    it('counts only correct when correctOnly is true', () => {
      const reqCorrectOnly: VolumeRequirement = {
        ...baseReq,
        correctOnly: true,
      };
      const mastery = [createMockMastery({ attempts_total: 20, attempts_correct: 8 })];
      const result = evaluateVolumeRequirement(reqCorrectOnly, mastery);
      
      expect(result.currentValue).toBe(8);
      expect(result.status).toBe('in_progress');
    });

    it('sums across multiple atoms', () => {
      const mastery = [
        createMockMastery({ atom_id: 1, attempts_total: 5 }),
        createMockMastery({ atom_id: 2, attempts_total: 6 }),
      ];
      const result = evaluateVolumeRequirement(baseReq, mastery);
      
      expect(result.currentValue).toBe(11);
      expect(result.status).toBe('passed');
    });
  });

  describe('evaluateStreakRequirement', () => {
    const baseReq: StreakRequirement = {
      type: 'streak',
      threshold: 5,
      description: '5 correct in a row',
    };

    it('passes when streak meets threshold', () => {
      const mastery = [createMockMastery({
        recent_attempts: [false, true, true, true, true, true],  // 5-streak at end
      })];
      const result = evaluateStreakRequirement(baseReq, mastery);
      
      expect(result.status).toBe('passed');
      expect(result.currentValue).toBe(5);
    });

    it('fails when streak broken', () => {
      const mastery = [createMockMastery({
        recent_attempts: [true, true, true, false, true, true],  // broken streak
      })];
      const result = evaluateStreakRequirement(baseReq, mastery);
      
      expect(result.status).toBe('in_progress');
      expect(result.currentValue).toBe(2);  // Only last 2 correct
    });

    it('finds best streak across atoms', () => {
      const mastery = [
        createMockMastery({ atom_id: 1, recent_attempts: [true, true, false] }),  // 0 streak
        createMockMastery({ atom_id: 2, recent_attempts: [true, true, true, true, true, true] }),  // 6 streak
      ];
      const result = evaluateStreakRequirement(baseReq, mastery);
      
      expect(result.currentValue).toBe(6);
      expect(result.status).toBe('passed');
    });

    it('returns locked with no attempts', () => {
      const mastery = [createMockMastery({ recent_attempts: [] })];
      const result = evaluateStreakRequirement(baseReq, mastery);
      
      expect(result.status).toBe('locked');
    });
  });
});
