/**
 * Timing Types
 * Type definitions for the timing system
 */

/** Question type for timing purposes */
export type TimedQuestionType = 
  | 'problem-solving'
  | 'data-sufficiency'
  | 'reading-comprehension'
  | 'critical-reasoning'
  | 'sentence-correction'
  | 'multi-source-reasoning'
  | 'table-analysis'
  | 'graphics-interpretation'
  | 'two-part-analysis';

/** Timing mode based on user level */
export type TimingMode = 
  | 'learning'      // L1-2: No strict timing
  | 'extended'      // L3-4: 1.5x standard budget
  | 'standard'      // L5-6: Standard budget with warnings
  | 'strict'        // L7-8: Standard budget, strict enforcement
  | 'test-realistic'; // L9-10: Test-realistic pacing

/** Timer state */
export type TimerState = 'idle' | 'running' | 'paused' | 'expired' | 'completed';

/** Time budget for a question */
export interface TimeBudget {
  /** Standard time in seconds */
  standardSeconds: number;
  /** Adjusted time based on level and mode */
  adjustedSeconds: number;
  /** Warning threshold (percentage of budget) */
  warningThreshold: number;
  /** Whether to enforce strictly */
  strictEnforcement: boolean;
  /** Timing mode */
  mode: TimingMode;
}

/** Timer session for a question */
export interface TimerSession {
  id: string;
  questionId: string;
  userId: string;
  questionType: TimedQuestionType;
  budget: TimeBudget;
  state: TimerState;
  startTime?: Date;
  pauseTime?: Date;
  endTime?: Date;
  elapsedMs: number;
  pausedMs: number;
  warnings: TimerWarning[];
}

/** Timer warning event */
export interface TimerWarning {
  type: 'approaching-limit' | 'over-time' | 'pace-drift';
  timestamp: Date;
  percentUsed: number;
  message: string;
}

/** Timing result for analytics */
export interface TimingResult {
  questionId: string;
  questionType: TimedQuestionType;
  budgetSeconds: number;
  actualSeconds: number;
  timeRatio: number; // actual / budget
  wasOvertime: boolean;
  percentUsed: number;
  timingCategory: 'fast' | 'optimal' | 'slow' | 'overtime';
}

/** Standard time budgets by question type (in seconds) */
export const STANDARD_TIME_BUDGETS: Record<TimedQuestionType, number> = {
  'problem-solving': 120,           // 2 minutes
  'data-sufficiency': 120,          // 2 minutes
  'reading-comprehension': 150,     // 2.5 minutes (per question, not passage)
  'critical-reasoning': 120,        // 2 minutes
  'sentence-correction': 90,        // 1.5 minutes
  'multi-source-reasoning': 150,    // 2.5 minutes
  'table-analysis': 150,            // 2.5 minutes
  'graphics-interpretation': 120,   // 2 minutes
  'two-part-analysis': 180          // 3 minutes
};

/** Time multipliers by timing mode */
export const TIME_MULTIPLIERS: Record<TimingMode, number> = {
  'learning': 3.0,        // Triple time for learning
  'extended': 1.5,        // 50% extra time
  'standard': 1.0,        // Standard time
  'strict': 1.0,          // Standard time, strict enforcement
  'test-realistic': 1.0   // Standard time, test conditions
};

/** Warning thresholds by timing mode */
export const WARNING_THRESHOLDS: Record<TimingMode, number> = {
  'learning': 1.0,        // No warnings
  'extended': 0.9,        // Warn at 90%
  'standard': 0.8,        // Warn at 80%
  'strict': 0.7,          // Warn at 70%
  'test-realistic': 0.6   // Warn at 60%
};

/** Strict enforcement by timing mode */
export const STRICT_ENFORCEMENT: Record<TimingMode, boolean> = {
  'learning': false,
  'extended': false,
  'standard': false,
  'strict': true,
  'test-realistic': true
};

/** Level to timing mode mapping */
export const LEVEL_TO_TIMING_MODE: Record<number, TimingMode> = {
  1: 'learning',
  2: 'learning',
  3: 'extended',
  4: 'extended',
  5: 'standard',
  6: 'standard',
  7: 'strict',
  8: 'strict',
  9: 'test-realistic',
  10: 'test-realistic'
};

/** Timing analytics configuration */
export interface TimingAnalyticsConfig {
  /** Minimum samples for reliable statistics */
  minSamples: number;
  /** Drift detection window (number of questions) */
  driftWindow: number;
  /** Drift threshold (percentage increase to flag) */
  driftThreshold: number;
  /** Fast threshold (percentage of budget) */
  fastThreshold: number;
  /** Slow threshold (percentage of budget) */
  slowThreshold: number;
}

/** Default analytics configuration */
export const DEFAULT_ANALYTICS_CONFIG: TimingAnalyticsConfig = {
  minSamples: 5,
  driftWindow: 10,
  driftThreshold: 0.2,  // 20% increase flags drift
  fastThreshold: 0.6,   // < 60% is fast
  slowThreshold: 1.0    // > 100% is slow
};

/** Timing statistics for a question type */
export interface TimingStats {
  questionType: TimedQuestionType;
  sampleCount: number;
  meanSeconds: number;
  medianSeconds: number;
  stdDevSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  percentFast: number;
  percentOptimal: number;
  percentSlow: number;
  percentOvertime: number;
}

/** Session timing summary */
export interface SessionTimingSummary {
  totalQuestions: number;
  totalTimeSeconds: number;
  averageTimeSeconds: number;
  fastCount: number;
  optimalCount: number;
  slowCount: number;
  overtimeCount: number;
  driftDetected: boolean;
  driftMagnitude?: number;
  byQuestionType: Map<TimedQuestionType, TimingStats>;
}

/** Abandonment tracking */
export interface AbandonmentEvent {
  questionId: string;
  questionType: TimedQuestionType;
  timeBeforeAbandonMs: number;
  percentBudgetUsed: number;
  wasStrategicGuess: boolean;
  reason?: 'timeout' | 'gave-up' | 'skipped' | 'strategic';
}
