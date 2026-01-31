/**
 * ELO Constants
 * Configuration values for the adaptive difficulty system
 */

// ============================================
// Core ELO Parameters
// ============================================

/** Default starting ELO for new players */
export const DEFAULT_RATING = 500;

/** GMAT scale bounds (200-800 mapped to our system) */
export const MIN_RATING = 100;
export const MAX_RATING = 900;

/** Rating deviation defaults (uncertainty measure) */
export const DEFAULT_DEVIATION = 350;
export const MIN_DEVIATION = 30;
export const MAX_DEVIATION = 500;

/** Default volatility (rate of expected change) */
export const DEFAULT_VOLATILITY = 0.06;

// ============================================
// K-Factor Configuration (Rating Change Speed)
// ============================================

/**
 * K-Factor determines how much ratings change per game.
 * Higher = faster changes, Lower = more stability.
 */
export const K_FACTORS = {
  /** New players (< 10 games): fast convergence */
  PROVISIONAL: 48,
  /** Establishing (10-30 games): moderate speed */
  ESTABLISHING: 32,
  /** Confident (30-100 games): slower changes */
  CONFIDENT: 24,
  /** Stable (100+ games): very stable */
  STABLE: 16,
  /** Minimum K-factor regardless of games */
  MINIMUM: 12,
  /** Maximum K-factor for high uncertainty */
  MAXIMUM: 64,
};

/** Game count thresholds for K-factor tiers */
export const K_FACTOR_THRESHOLDS = {
  PROVISIONAL: 10,
  ESTABLISHING: 30,
  CONFIDENT: 100,
};

// ============================================
// Confidence Levels
// ============================================

/** Games needed to reach confidence levels */
export const CONFIDENCE_THRESHOLDS = {
  PROVISIONAL: 0,     // 0-9 games
  ESTABLISHING: 10,   // 10-29 games
  CONFIDENT: 30,      // 30-99 games
  STABLE: 100,        // 100+ games
};

/** Confidence level descriptions */
export const CONFIDENCE_DESCRIPTIONS = {
  PROVISIONAL: 'Rating is still being established',
  ESTABLISHING: 'Rating is converging on true skill',
  CONFIDENT: 'Rating is a good estimate of skill',
  STABLE: 'Rating is highly reliable',
};

// ============================================
// Difficulty Matching Parameters
// ============================================

/** Target win rates by training mode */
export const TARGET_WIN_RATES = {
  /** Build mode: confidence building */
  build: 0.75,
  /** Prove mode: true mastery test */
  prove: 0.55,
  /** Review mode: reinforcement */
  review: 0.80,
  /** Diagnostic mode: assessment */
  diagnostic: 0.50,
};

/** Difficulty band offsets from user ELO by mode */
export const DIFFICULTY_OFFSETS = {
  /** Build: target slightly easier */
  build: -75,
  /** Prove: target at level */
  prove: 0,
  /** Review: target comfortable */
  review: -50,
  /** Diagnostic: target exact level */
  diagnostic: 0,
};

/** Difficulty range spread (±) by mode */
export const DIFFICULTY_SPREADS = {
  /** Build: narrow range for consistency */
  build: 75,
  /** Prove: moderate range */
  prove: 50,
  /** Review: moderate range */
  review: 50,
  /** Diagnostic: wide range for assessment */
  diagnostic: 150,
};

// ============================================
// Question Selection Distribution
// ============================================

/** Percentage allocation for question difficulty mix */
export const SELECTION_DISTRIBUTION = {
  /** Questions near current rating (±50 points) */
  NEAR_RATING: 0.60,
  /** Slight stretch questions (+50 to +100) */
  STRETCH: 0.20,
  /** Weakness targeting (gates, errors) */
  WEAKNESS: 0.15,
  /** Random exploration (any difficulty) */
  RANDOM: 0.05,
};

// ============================================
// Anti-Grind Parameters
// ============================================

/** Maximum rating gain from questions too far below level */
export const ANTI_GRIND = {
  /** If expected win rate > this, reduce gains */
  EASY_THRESHOLD: 0.85,
  /** Multiplier for ELO gains on easy questions */
  EASY_GAIN_MULTIPLIER: 0.5,
  /** If same difficulty band in last N questions, reduce gains */
  REPETITION_WINDOW: 10,
  /** Multiplier when grinding same difficulty */
  REPETITION_PENALTY: 0.75,
  /** Questions below this relative difficulty yield no gains */
  FLOOR_DIFFICULTY_OFFSET: -200,
};

// ============================================
// Timing Adjustments
// ============================================

/** Timing ratio thresholds (actual time / budget time) */
export const TIMING_THRESHOLDS = {
  VERY_FAST: 0.4,   // Under 40% of budget
  FAST: 0.6,        // 40-60% of budget
  NORMAL_MAX: 1.0,  // Up to 100% of budget
  SLOW: 1.5,        // 100-150% of budget
  VERY_SLOW: 2.0,   // Over 150% of budget
};

/** ELO adjustment multipliers based on timing */
export const TIMING_MULTIPLIERS = {
  /** Very fast correct: small bonus */
  VERY_FAST_CORRECT: 1.1,
  /** Fast correct: small bonus */
  FAST_CORRECT: 1.05,
  /** Normal: no adjustment */
  NORMAL: 1.0,
  /** Slow correct: slight penalty */
  SLOW_CORRECT: 0.95,
  /** Very slow: larger penalty */
  VERY_SLOW_CORRECT: 0.85,
  /** Very fast incorrect: might be guessing */
  VERY_FAST_INCORRECT: 1.1,  // Bigger penalty
};

// ============================================
// Streak & Momentum
// ============================================

/** Streak thresholds for momentum states */
export const MOMENTUM_THRESHOLDS = {
  /** Win streak for "hot" momentum */
  HOT: 5,
  /** Win streak for "warm" momentum */
  WARM: 3,
  /** Loss streak for "cold" momentum */
  COLD: 3,
  /** Loss streak for "slump" momentum */
  SLUMP: 5,
};

/** ELO bonus/penalty for streaks */
export const STREAK_ADJUSTMENTS = {
  /** Bonus multiplier when on a hot streak */
  HOT_BONUS: 1.15,
  /** Bonus when warm */
  WARM_BONUS: 1.05,
  /** Penalty when cold */
  COLD_PENALTY: 1.05,  // Losses hurt more
  /** Penalty when in slump */
  SLUMP_PENALTY: 1.15,
};

// ============================================
// Session Fatigue
// ============================================

/** Fatigue detection thresholds */
export const FATIGUE_THRESHOLDS = {
  /** Questions before fatigue might set in */
  OPTIMAL_SESSION_LENGTH: 25,
  /** Questions where fatigue is likely */
  FATIGUE_WARNING: 40,
  /** Questions where break is recommended */
  FATIGUE_CRITICAL: 60,
  /** Accuracy drop indicating fatigue (recent vs session) */
  ACCURACY_DROP_THRESHOLD: 0.15,
};

// ============================================
// ELO to GMAT Score Mapping
// ============================================

/** Approximate ELO to GMAT scaled score conversion */
export const ELO_TO_GMAT_MAP = [
  { elo: 100, gmat: 200 },
  { elo: 200, gmat: 300 },
  { elo: 300, gmat: 400 },
  { elo: 400, gmat: 480 },
  { elo: 500, gmat: 550 },
  { elo: 600, gmat: 620 },
  { elo: 700, gmat: 690 },
  { elo: 800, gmat: 750 },
  { elo: 900, gmat: 800 },
];

/** Convert internal ELO to estimated GMAT score */
export function eloToGmatScore(elo: number): number {
  const map = ELO_TO_GMAT_MAP;
  
  if (elo <= map[0].elo) return map[0].gmat;
  if (elo >= map[map.length - 1].elo) return map[map.length - 1].gmat;
  
  for (let i = 1; i < map.length; i++) {
    if (elo <= map[i].elo) {
      const ratio = (elo - map[i - 1].elo) / (map[i].elo - map[i - 1].elo);
      return Math.round(map[i - 1].gmat + ratio * (map[i].gmat - map[i - 1].gmat));
    }
  }
  
  return 550; // Default fallback
}

/** Convert GMAT score to internal ELO */
export function gmatScoreToElo(gmat: number): number {
  const map = ELO_TO_GMAT_MAP;
  
  if (gmat <= map[0].gmat) return map[0].elo;
  if (gmat >= map[map.length - 1].gmat) return map[map.length - 1].elo;
  
  for (let i = 1; i < map.length; i++) {
    if (gmat <= map[i].gmat) {
      const ratio = (gmat - map[i - 1].gmat) / (map[i].gmat - map[i - 1].gmat);
      return Math.round(map[i - 1].elo + ratio * (map[i].elo - map[i - 1].elo));
    }
  }
  
  return 500; // Default fallback
}
