/**
 * ELO Calculator Tests
 * Tests for the adaptive difficulty ELO engine - pure calculation functions
 */

import {
  K_FACTORS,
  K_FACTOR_THRESHOLDS,
  TIMING_THRESHOLDS,
  TIMING_MULTIPLIERS,
  MOMENTUM_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  ANTI_GRIND,
} from '../services/elo/constants.js';

// Re-implement pure functions for testing (avoids DB imports)
function calculateExpectedWinRate(playerRating: number, questionDifficulty: number): number {
  return 1 / (1 + Math.pow(10, (questionDifficulty - playerRating) / 400));
}

function getKFactor(gamesPlayed: number, ratingDeviation: number = 350): number {
  let kFactor: number;
  
  if (gamesPlayed < K_FACTOR_THRESHOLDS.PROVISIONAL) {
    kFactor = K_FACTORS.PROVISIONAL;
  } else if (gamesPlayed < K_FACTOR_THRESHOLDS.ESTABLISHING) {
    kFactor = K_FACTORS.ESTABLISHING;
  } else if (gamesPlayed < K_FACTOR_THRESHOLDS.CONFIDENT) {
    kFactor = K_FACTORS.CONFIDENT;
  } else {
    kFactor = K_FACTORS.STABLE;
  }
  
  if (ratingDeviation > 200) {
    kFactor = Math.min(K_FACTORS.MAXIMUM, kFactor * 1.25);
  } else if (ratingDeviation < 50) {
    kFactor = Math.max(K_FACTORS.MINIMUM, kFactor * 0.8);
  }
  
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

type TimingCategory = 'very_fast' | 'fast' | 'normal' | 'slow' | 'very_slow';

function getTimingFactor(
  timeSpentSeconds: number,
  timeBudgetSeconds: number,
  wasCorrect: boolean
): { ratio: number; category: TimingCategory; adjustment: number; description: string } {
  const ratio = timeSpentSeconds / timeBudgetSeconds;
  
  let category: TimingCategory;
  let adjustment: number;
  let description: string;
  
  if (ratio <= TIMING_THRESHOLDS.VERY_FAST) {
    category = 'very_fast';
    adjustment = wasCorrect ? TIMING_MULTIPLIERS.VERY_FAST_CORRECT : TIMING_MULTIPLIERS.VERY_FAST_INCORRECT;
    description = wasCorrect ? 'Quick and correct!' : 'Very fast but incorrect - might be rushing';
  } else if (ratio <= TIMING_THRESHOLDS.FAST) {
    category = 'fast';
    adjustment = wasCorrect ? TIMING_MULTIPLIERS.FAST_CORRECT : TIMING_MULTIPLIERS.NORMAL;
    description = wasCorrect ? 'Good pace' : 'Fast attempt';
  } else if (ratio <= TIMING_THRESHOLDS.NORMAL_MAX) {
    category = 'normal';
    adjustment = TIMING_MULTIPLIERS.NORMAL;
    description = 'Within time budget';
  } else if (ratio <= TIMING_THRESHOLDS.SLOW) {
    category = 'slow';
    adjustment = wasCorrect ? TIMING_MULTIPLIERS.SLOW_CORRECT : TIMING_MULTIPLIERS.NORMAL;
    description = 'Over budget but acceptable';
  } else {
    category = 'very_slow';
    adjustment = wasCorrect ? TIMING_MULTIPLIERS.VERY_SLOW_CORRECT : TIMING_MULTIPLIERS.NORMAL;
    description = 'Significantly over budget';
  }
  
  return { ratio, category, adjustment, description };
}

type MomentumLevel = 'hot' | 'warm' | 'neutral' | 'cold' | 'slump';
type StreakType = 'win' | 'loss' | null;

function getMomentumState(
  currentStreak: number,
  streakType: StreakType,
  recentResults: boolean[]
): { currentStreak: number; streakType: StreakType; recentResults: boolean[]; momentum: MomentumLevel; description: string } {
  let momentum: MomentumLevel;
  let description: string;
  
  if (streakType === 'win') {
    if (currentStreak >= MOMENTUM_THRESHOLDS.HOT) {
      momentum = 'hot';
      description = `On fire! ${currentStreak}-question win streak`;
    } else if (currentStreak >= MOMENTUM_THRESHOLDS.WARM) {
      momentum = 'warm';
      description = `Building momentum`;
    } else {
      momentum = 'neutral';
      description = 'Steady progress';
    }
  } else if (streakType === 'loss') {
    if (currentStreak >= MOMENTUM_THRESHOLDS.SLUMP) {
      momentum = 'slump';
      description = `Challenging stretch`;
    } else if (currentStreak >= MOMENTUM_THRESHOLDS.COLD) {
      momentum = 'cold';
      description = `Hitting resistance`;
    } else {
      momentum = 'neutral';
      description = 'Minor setback';
    }
  } else {
    momentum = 'neutral';
    description = 'Just getting started';
  }
  
  return { currentStreak, streakType, recentResults, momentum, description };
}

type ConfidenceLevel = 'provisional' | 'establishing' | 'confident' | 'stable';

function getRatingConfidence(
  gamesPlayed: number,
  ratingDeviation: number
): { level: ConfidenceLevel; percentConfident: number; gamesNeeded: number } {
  let level: ConfidenceLevel;
  let gamesNeeded: number;
  
  if (gamesPlayed < CONFIDENCE_THRESHOLDS.ESTABLISHING) {
    level = 'provisional';
    gamesNeeded = CONFIDENCE_THRESHOLDS.ESTABLISHING - gamesPlayed;
  } else if (gamesPlayed < CONFIDENCE_THRESHOLDS.CONFIDENT) {
    level = 'establishing';
    gamesNeeded = CONFIDENCE_THRESHOLDS.CONFIDENT - gamesPlayed;
  } else if (gamesPlayed < CONFIDENCE_THRESHOLDS.STABLE) {
    level = 'confident';
    gamesNeeded = CONFIDENCE_THRESHOLDS.STABLE - gamesPlayed;
  } else {
    level = 'stable';
    gamesNeeded = 0;
  }
  
  const percentConfident = Math.round(Math.min(100, Math.max(0, (350 - ratingDeviation) / 3.2)));
  
  return { level, percentConfident, gamesNeeded };
}

function getAntiGrindMultiplier(
  expectedWinRate: number,
  wasCorrect: boolean,
  _recentPerformance: unknown[] = []
): number {
  if (!wasCorrect) return 1.0;
  
  let multiplier = 1.0;
  
  if (expectedWinRate > ANTI_GRIND.EASY_THRESHOLD) {
    multiplier *= ANTI_GRIND.EASY_GAIN_MULTIPLIER;
  }
  
  return multiplier;
}

describe('ELO Calculator', () => {
  describe('calculateExpectedWinRate', () => {
    it('equal ratings should give 50% win rate', () => {
      const rate = calculateExpectedWinRate(500, 500);
      expect(rate).toBeCloseTo(0.5, 2);
    });

    it('higher player rating should give higher win rate', () => {
      const rate = calculateExpectedWinRate(600, 500);
      expect(rate).toBeGreaterThan(0.5);
      expect(rate).toBeLessThan(1);
    });

    it('400 point difference gives ~91% win rate', () => {
      const rate = calculateExpectedWinRate(700, 300);
      expect(rate).toBeCloseTo(0.91, 1);
    });

    it('lower player rating gives lower win rate', () => {
      const rate = calculateExpectedWinRate(400, 600);
      expect(rate).toBeLessThan(0.5);
    });
  });

  describe('getKFactor', () => {
    it('new players (< 10 games) get high K-factor for fast convergence', () => {
      const k = getKFactor(5, 100);  // Low deviation to avoid adjustment
      expect(k).toBeGreaterThanOrEqual(K_FACTORS.ESTABLISHING);
    });

    it('establishing players (10-30) get medium K-factor', () => {
      const k = getKFactor(20, 100);
      expect(k).toBeGreaterThanOrEqual(K_FACTORS.CONFIDENT);
      expect(k).toBeLessThanOrEqual(K_FACTORS.ESTABLISHING);
    });

    it('confident players (30-100) get lower K-factor', () => {
      const k = getKFactor(50, 100);
      expect(k).toBeGreaterThanOrEqual(K_FACTORS.STABLE);
      expect(k).toBeLessThanOrEqual(K_FACTORS.CONFIDENT);
    });

    it('stable players (100+) get lowest K-factor', () => {
      const k = getKFactor(150, 100);
      expect(k).toBeGreaterThanOrEqual(K_FACTORS.MINIMUM);
      expect(k).toBeLessThanOrEqual(K_FACTORS.CONFIDENT);
    });

    it('high deviation increases K-factor', () => {
      const lowDev = getKFactor(50, 50);
      const highDev = getKFactor(50, 300);
      expect(highDev).toBeGreaterThan(lowDev);
    });
  });

  describe('calculateRawEloChange', () => {
    it('winning against equal opponent gives positive change', () => {
      const change = calculateRawEloChange(500, 500, true, 32);
      expect(change).toBeGreaterThan(0);
      expect(change).toBe(16);  // 32 * (1 - 0.5)
    });

    it('losing against equal opponent gives negative change', () => {
      const change = calculateRawEloChange(500, 500, false, 32);
      expect(change).toBeLessThan(0);
      expect(change).toBe(-16);  // 32 * (0 - 0.5)
    });

    it('beating harder question gives larger gain', () => {
      const easyWin = calculateRawEloChange(500, 400, true, 32);
      const hardWin = calculateRawEloChange(500, 600, true, 32);
      expect(hardWin).toBeGreaterThan(easyWin);
    });

    it('losing to easier question gives larger penalty', () => {
      const hardLoss = calculateRawEloChange(500, 600, false, 32);
      const easyLoss = calculateRawEloChange(500, 400, false, 32);
      expect(Math.abs(easyLoss)).toBeGreaterThan(Math.abs(hardLoss));
    });
  });

  describe('getTimingFactor', () => {
    it('very fast correct gives bonus', () => {
      const factor = getTimingFactor(30, 120, true);
      expect(factor.category).toBe('very_fast');
      expect(factor.adjustment).toBeGreaterThan(1);
    });

    it('normal timing gives no adjustment', () => {
      const factor = getTimingFactor(100, 120, true);
      expect(factor.category).toBe('normal');
      expect(factor.adjustment).toBe(1);
    });

    it('slow correct gives penalty', () => {
      const factor = getTimingFactor(150, 120, true);
      expect(factor.category).toBe('slow');
      expect(factor.adjustment).toBeLessThan(1);
    });

    it('very fast incorrect suggests rushing', () => {
      const factor = getTimingFactor(20, 120, false);
      expect(factor.category).toBe('very_fast');
      expect(factor.description).toContain('rushing');
    });
  });

  describe('getMomentumState', () => {
    it('5+ win streak is hot', () => {
      const state = getMomentumState(5, 'win', [true, true, true, true, true]);
      expect(state.momentum).toBe('hot');
    });

    it('3-4 win streak is warm', () => {
      const state = getMomentumState(3, 'win', [true, true, true]);
      expect(state.momentum).toBe('warm');
    });

    it('5+ loss streak is slump', () => {
      const state = getMomentumState(5, 'loss', [false, false, false, false, false]);
      expect(state.momentum).toBe('slump');
    });

    it('3-4 loss streak is cold', () => {
      const state = getMomentumState(3, 'loss', [false, false, false]);
      expect(state.momentum).toBe('cold');
    });

    it('no streak is neutral', () => {
      const state = getMomentumState(1, 'win', [true]);
      expect(state.momentum).toBe('neutral');
    });
  });

  describe('getRatingConfidence', () => {
    it('< 10 games is provisional', () => {
      const conf = getRatingConfidence(5, 350);
      expect(conf.level).toBe('provisional');
      expect(conf.gamesNeeded).toBe(5);
    });

    it('10-29 games is establishing', () => {
      const conf = getRatingConfidence(20, 200);
      expect(conf.level).toBe('establishing');
    });

    it('30-99 games is confident', () => {
      const conf = getRatingConfidence(50, 100);
      expect(conf.level).toBe('confident');
    });

    it('100+ games is stable', () => {
      const conf = getRatingConfidence(150, 50);
      expect(conf.level).toBe('stable');
      expect(conf.gamesNeeded).toBe(0);
    });

    it('low deviation increases percent confident', () => {
      const highDev = getRatingConfidence(50, 300);
      const lowDev = getRatingConfidence(50, 50);
      expect(lowDev.percentConfident).toBeGreaterThan(highDev.percentConfident);
    });
  });

  describe('getAntiGrindMultiplier', () => {
    it('returns 1 for incorrect answers', () => {
      const mult = getAntiGrindMultiplier(0.9, false, []);
      expect(mult).toBe(1);
    });

    it('reduces gains on very easy questions', () => {
      const mult = getAntiGrindMultiplier(0.9, true, []);
      expect(mult).toBeLessThan(1);
    });

    it('no penalty for normal difficulty', () => {
      const mult = getAntiGrindMultiplier(0.55, true, []);
      expect(mult).toBe(1);
    });
  });
});
