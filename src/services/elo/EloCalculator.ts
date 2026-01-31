/**
 * ELO Calculator
 * Core ELO rating calculation engine with GMAT-specific adjustments
 */

import {
  DEFAULT_RATING,
  MIN_RATING,
  MAX_RATING,
  K_FACTORS,
  K_FACTOR_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_DESCRIPTIONS,
  ANTI_GRIND,
  TIMING_THRESHOLDS,
  TIMING_MULTIPLIERS,
  MOMENTUM_THRESHOLDS,
  STREAK_ADJUSTMENTS,
} from './constants.js';

import type {
  RatingUpdateInput,
  RatingUpdateResult,
  MultiScopeUpdateResult,
  RatingConfidence,
  TimingFactor,
  MomentumState,
  StreakType,
  GrindDetectionResult,
  RecentPerformance,
} from './types.js';

import {
  getOrCreateRating,
  updateRating as dbUpdateRating,
  calculateExpectedScore,
  type EloRating,
} from '../../models/EloRating.js';

// ============================================
// Core ELO Calculations
// ============================================

/**
 * Calculate expected score (win probability) using ELO formula
 * @param playerRating The player's current rating
 * @param questionDifficulty The question's difficulty rating
 * @returns Probability of correct answer (0-1)
 */
export function calculateExpectedWinRate(
  playerRating: number,
  questionDifficulty: number
): number {
  return calculateExpectedScore(playerRating, questionDifficulty);
}

/**
 * Get the appropriate K-factor based on games played and uncertainty
 * @param gamesPlayed Number of games/questions completed
 * @param ratingDeviation Current rating deviation (uncertainty)
 * @returns K-factor to use for rating calculations
 */
export function getKFactor(
  gamesPlayed: number,
  ratingDeviation: number = 350
): number {
  // Base K-factor from games played
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
  
  // Adjust based on rating deviation (high uncertainty = higher K)
  if (ratingDeviation > 200) {
    kFactor = Math.min(K_FACTORS.MAXIMUM, kFactor * 1.25);
  } else if (ratingDeviation < 50) {
    kFactor = Math.max(K_FACTORS.MINIMUM, kFactor * 0.8);
  }
  
  return Math.round(kFactor);
}

/**
 * Calculate raw ELO change before adjustments
 * @param currentRating Player's current rating
 * @param questionDifficulty Question difficulty rating
 * @param wasCorrect Whether the answer was correct
 * @param kFactor K-factor to use
 * @returns Raw rating change
 */
export function calculateRawEloChange(
  currentRating: number,
  questionDifficulty: number,
  wasCorrect: boolean,
  kFactor: number
): number {
  const expectedScore = calculateExpectedWinRate(currentRating, questionDifficulty);
  const actualScore = wasCorrect ? 1 : 0;
  return kFactor * (actualScore - expectedScore);
}

/**
 * Get timing factor adjustment
 */
export function getTimingFactor(
  timeSpentSeconds: number,
  timeBudgetSeconds: number,
  wasCorrect: boolean
): TimingFactor {
  const ratio = timeSpentSeconds / timeBudgetSeconds;
  
  let category: TimingFactor['category'];
  let adjustment: number;
  let description: string;
  
  if (ratio <= TIMING_THRESHOLDS.VERY_FAST) {
    category = 'very_fast';
    adjustment = wasCorrect ? TIMING_MULTIPLIERS.VERY_FAST_CORRECT : TIMING_MULTIPLIERS.VERY_FAST_INCORRECT;
    description = wasCorrect 
      ? 'Quick and correct - excellent efficiency!'
      : 'Very fast but incorrect - might be rushing';
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
    description = 'Significantly over budget - work on pacing';
  }
  
  return { ratio, category, adjustment, description };
}

/**
 * Detect grinding behavior (farming easy questions)
 */
export function detectGrinding(
  recentPerformance: RecentPerformance[],
  currentRating: number
): GrindDetectionResult {
  if (recentPerformance.length < 5) {
    return {
      isGrinding: false,
      grindScore: 0,
      recommendation: 'continue',
      reason: 'Not enough data to assess',
    };
  }
  
  // Calculate metrics
  const avgDifficulty = recentPerformance.reduce((sum, p) => sum + p.difficulty, 0) / recentPerformance.length;
  const accuracy = recentPerformance.filter(p => p.wasCorrect).length / recentPerformance.length;
  const difficultyGap = currentRating - avgDifficulty;
  
  let grindScore = 0;
  const reasons: string[] = [];
  
  // High accuracy on easy questions
  if (accuracy > 0.9 && difficultyGap > 100) {
    grindScore += 40;
    reasons.push('High accuracy on below-level questions');
  }
  
  // Average difficulty way below rating
  if (difficultyGap > 150) {
    grindScore += 30;
    reasons.push('Practicing far below current level');
  }
  
  // Very consistent (no challenge)
  const difficultyVariance = calculateVariance(recentPerformance.map(p => p.difficulty));
  if (difficultyVariance < 1000) {  // Low variance in difficulty
    grindScore += 15;
    reasons.push('Very narrow difficulty range');
  }
  
  // Almost perfect streak
  if (accuracy > 0.95) {
    grindScore += 15;
    reasons.push('Near-perfect performance suggests insufficient challenge');
  }
  
  // Determine recommendation
  let recommendation: GrindDetectionResult['recommendation'];
  if (grindScore >= 60) {
    recommendation = 'increase_difficulty';
  } else if (grindScore >= 40) {
    recommendation = 'change_topic';
  } else {
    recommendation = 'continue';
  }
  
  return {
    isGrinding: grindScore >= 50,
    grindScore,
    recommendation,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Normal practice pattern',
  };
}

/**
 * Calculate anti-grind multiplier
 */
export function getAntiGrindMultiplier(
  expectedWinRate: number,
  wasCorrect: boolean,
  recentPerformance: RecentPerformance[]
): number {
  // Only penalize gains, not losses
  if (!wasCorrect) return 1.0;
  
  let multiplier = 1.0;
  
  // Reduce gains on very easy questions
  if (expectedWinRate > ANTI_GRIND.EASY_THRESHOLD) {
    multiplier *= ANTI_GRIND.EASY_GAIN_MULTIPLIER;
  }
  
  // Reduce gains on repetitive difficulty
  if (recentPerformance.length >= ANTI_GRIND.REPETITION_WINDOW) {
    const recentCorrect = recentPerformance
      .slice(-ANTI_GRIND.REPETITION_WINDOW)
      .filter(p => p.wasCorrect).length;
    
    if (recentCorrect >= ANTI_GRIND.REPETITION_WINDOW * 0.9) {
      multiplier *= ANTI_GRIND.REPETITION_PENALTY;
    }
  }
  
  return multiplier;
}

/**
 * Get momentum state from recent performance
 */
export function getMomentumState(
  currentStreak: number,
  streakType: StreakType,
  recentResults: boolean[]
): MomentumState {
  let momentum: MomentumState['momentum'];
  let description: string;
  
  if (streakType === 'win') {
    if (currentStreak >= MOMENTUM_THRESHOLDS.HOT) {
      momentum = 'hot';
      description = `On fire! ${currentStreak}-question win streak`;
    } else if (currentStreak >= MOMENTUM_THRESHOLDS.WARM) {
      momentum = 'warm';
      description = `Building momentum with ${currentStreak} correct`;
    } else {
      momentum = 'neutral';
      description = 'Steady progress';
    }
  } else if (streakType === 'loss') {
    if (currentStreak >= MOMENTUM_THRESHOLDS.SLUMP) {
      momentum = 'slump';
      description = `Challenging stretch - ${currentStreak} in a row`;
    } else if (currentStreak >= MOMENTUM_THRESHOLDS.COLD) {
      momentum = 'cold';
      description = `Hitting some resistance - ${currentStreak} incorrect`;
    } else {
      momentum = 'neutral';
      description = 'Minor setback';
    }
  } else {
    momentum = 'neutral';
    description = 'Just getting started';
  }
  
  return {
    currentStreak,
    streakType,
    recentResults,
    momentum,
    description,
  };
}

/**
 * Get confidence level for a rating
 */
export function getRatingConfidence(
  gamesPlayed: number,
  ratingDeviation: number
): RatingConfidence {
  let level: RatingConfidence['level'];
  let gamesNeeded: number;
  let description: string;
  
  if (gamesPlayed < CONFIDENCE_THRESHOLDS.ESTABLISHING) {
    level = 'provisional';
    gamesNeeded = CONFIDENCE_THRESHOLDS.ESTABLISHING - gamesPlayed;
    description = CONFIDENCE_DESCRIPTIONS.PROVISIONAL;
  } else if (gamesPlayed < CONFIDENCE_THRESHOLDS.CONFIDENT) {
    level = 'establishing';
    gamesNeeded = CONFIDENCE_THRESHOLDS.CONFIDENT - gamesPlayed;
    description = CONFIDENCE_DESCRIPTIONS.ESTABLISHING;
  } else if (gamesPlayed < CONFIDENCE_THRESHOLDS.STABLE) {
    level = 'confident';
    gamesNeeded = CONFIDENCE_THRESHOLDS.STABLE - gamesPlayed;
    description = CONFIDENCE_DESCRIPTIONS.CONFIDENT;
  } else {
    level = 'stable';
    gamesNeeded = 0;
    description = CONFIDENCE_DESCRIPTIONS.STABLE;
  }
  
  // Calculate percent confident based on deviation
  const percentConfident = Math.round(
    Math.min(100, Math.max(0, (350 - ratingDeviation) / 3.2))
  );
  
  return { level, percentConfident, gamesNeeded, description };
}

/**
 * Calculate final ELO change with all adjustments
 */
export function calculateAdjustedEloChange(
  currentRating: number,
  questionDifficulty: number,
  wasCorrect: boolean,
  kFactor: number,
  timingFactor: TimingFactor,
  antiGrindMultiplier: number,
  momentum: MomentumState
): number {
  // Start with raw change
  let change = calculateRawEloChange(currentRating, questionDifficulty, wasCorrect, kFactor);
  
  // Apply timing adjustment
  change *= timingFactor.adjustment;
  
  // Apply anti-grind (only affects gains)
  if (change > 0) {
    change *= antiGrindMultiplier;
  }
  
  // Apply momentum adjustment
  if (wasCorrect && (momentum.momentum === 'hot' || momentum.momentum === 'warm')) {
    change *= momentum.momentum === 'hot' 
      ? STREAK_ADJUSTMENTS.HOT_BONUS 
      : STREAK_ADJUSTMENTS.WARM_BONUS;
  } else if (!wasCorrect && (momentum.momentum === 'slump' || momentum.momentum === 'cold')) {
    change *= momentum.momentum === 'slump'
      ? STREAK_ADJUSTMENTS.SLUMP_PENALTY
      : STREAK_ADJUSTMENTS.COLD_PENALTY;
  }
  
  // Clamp rating change to reasonable bounds
  const maxChange = kFactor * 1.5;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  
  return Math.round(change);
}

/**
 * Update a rating with all adjustments applied
 */
export function updateRatingWithAdjustments(
  input: RatingUpdateInput,
  recentPerformance: RecentPerformance[] = []
): RatingUpdateResult {
  // Get or create the rating
  const rating = getOrCreateRating(
    input.scopeType === 'question_type' ? 'topic' : input.scopeType as any,
    input.scopeCode
  );
  
  // Calculate all factors
  const kFactor = getKFactor(rating.games_played, rating.rating_deviation);
  const expectedWinRate = calculateExpectedWinRate(rating.rating, input.questionDifficulty);
  const timingFactor = getTimingFactor(input.timeSpentSeconds, input.timeBudgetSeconds, input.wasCorrect);
  const antiGrindMultiplier = getAntiGrindMultiplier(expectedWinRate, input.wasCorrect, recentPerformance);
  const momentum = getMomentumState(rating.current_streak, rating.streak_type, rating.last_5_results);
  
  // Calculate adjusted change
  const ratingChange = calculateAdjustedEloChange(
    rating.rating,
    input.questionDifficulty,
    input.wasCorrect,
    kFactor,
    timingFactor,
    antiGrindMultiplier,
    momentum
  );
  
  // Calculate new rating
  const newRating = Math.max(MIN_RATING, Math.min(MAX_RATING, rating.rating + ratingChange));
  const isNewPeak = newRating > rating.peak_rating;
  
  // Update in database
  const updated = dbUpdateRating(
    rating.id,
    input.questionDifficulty,
    input.wasCorrect,
    input.attemptId
  );
  
  return {
    scopeType: input.scopeType,
    scopeCode: input.scopeCode,
    previousRating: rating.rating,
    newRating: updated.rating,
    ratingChange: updated.rating - rating.rating,
    gamesPlayed: updated.games_played,
    isNewPeak,
    confidenceLevel: updated.confidence_level,
  };
}

/**
 * Update ratings across multiple scopes (global, section, topic)
 */
export function updateMultiScopeRatings(
  input: RatingUpdateInput & { sectionCode?: string; topicCode?: string }
): MultiScopeUpdateResult {
  const recentPerformance: RecentPerformance[] = []; // Could be loaded from DB
  
  // Always update global
  const globalResult = updateRatingWithAdjustments(
    { ...input, scopeType: 'global', scopeCode: null },
    recentPerformance
  );
  
  const result: MultiScopeUpdateResult = { global: globalResult };
  
  // Update section if provided
  if (input.sectionCode) {
    result.section = updateRatingWithAdjustments(
      { ...input, scopeType: 'section', scopeCode: input.sectionCode },
      recentPerformance
    );
  }
  
  // Update topic if provided
  if (input.topicCode) {
    result.topic = updateRatingWithAdjustments(
      { ...input, scopeType: 'topic', scopeCode: input.topicCode },
      recentPerformance
    );
  }
  
  return result;
}

// ============================================
// Utility Functions
// ============================================

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

// ============================================
// Singleton Export
// ============================================

let calculatorInstance: EloCalculator | null = null;

export class EloCalculator {
  calculateExpectedWinRate = calculateExpectedWinRate;
  getKFactor = getKFactor;
  calculateRawEloChange = calculateRawEloChange;
  getTimingFactor = getTimingFactor;
  detectGrinding = detectGrinding;
  getAntiGrindMultiplier = getAntiGrindMultiplier;
  getMomentumState = getMomentumState;
  getRatingConfidence = getRatingConfidence;
  calculateAdjustedEloChange = calculateAdjustedEloChange;
  updateRatingWithAdjustments = updateRatingWithAdjustments;
  updateMultiScopeRatings = updateMultiScopeRatings;
}

export function getEloCalculator(): EloCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new EloCalculator();
  }
  return calculatorInstance;
}
