/**
 * ELO Engine Types
 * Type definitions for the adaptive difficulty system
 */

// ============================================
// Rating Scopes
// ============================================

export type RatingScope = 'global' | 'section' | 'question_type' | 'topic' | 'atom_cluster';

export interface ScopeIdentifier {
  scope: RatingScope;
  code: string | null;
}

// ============================================
// Rating Updates
// ============================================

export interface RatingUpdateInput {
  scopeType: RatingScope;
  scopeCode: string | null;
  questionDifficulty: number;
  wasCorrect: boolean;
  timeSpentSeconds: number;
  timeBudgetSeconds: number;
  attemptId?: number;
}

export interface RatingUpdateResult {
  scopeType: RatingScope;
  scopeCode: string | null;
  previousRating: number;
  newRating: number;
  ratingChange: number;
  gamesPlayed: number;
  isNewPeak: boolean;
  confidenceLevel: number;
}

export interface MultiScopeUpdateResult {
  global: RatingUpdateResult;
  section?: RatingUpdateResult;
  questionType?: RatingUpdateResult;
  topic?: RatingUpdateResult;
}

// ============================================
// Question Matching
// ============================================

export interface DifficultyTarget {
  centerElo: number;
  minElo: number;
  maxElo: number;
  targetWinRate: number;
}

export interface QuestionMatchScore {
  questionId: number;
  questionDifficulty: number;
  matchScore: number;  // 0-100 score
  expectedWinRate: number;
  category: 'easy' | 'optimal' | 'hard' | 'stretch';
  reasons: string[];
}

// ============================================
// Anti-Grind System
// ============================================

export interface RecentPerformance {
  questionId: number;
  difficulty: number;
  wasCorrect: boolean;
  timestamp: Date;
}

export interface GrindDetectionResult {
  isGrinding: boolean;
  grindScore: number;  // 0-100, higher = more grinding behavior
  recommendation: 'continue' | 'increase_difficulty' | 'change_topic' | 'take_break';
  reason: string;
}

// ============================================
// Rating Confidence
// ============================================

export interface RatingConfidence {
  level: 'provisional' | 'establishing' | 'confident' | 'stable';
  percentConfident: number;
  gamesNeeded: number;
  description: string;
}

// ============================================
// Streak & Momentum
// ============================================

export type StreakType = 'win' | 'loss' | null;

export interface MomentumState {
  currentStreak: number;
  streakType: StreakType;
  recentResults: boolean[];  // Last 10 results
  momentum: 'hot' | 'warm' | 'neutral' | 'cold' | 'slump';
  description: string;
}

// ============================================
// Performance Analysis
// ============================================

export interface PerformanceWindow {
  windowSize: number;
  attempts: number;
  correct: number;
  accuracy: number;
  avgDifficulty: number;
  avgTimeRatio: number;  // actual/budget
  ratingTrend: 'rising' | 'stable' | 'falling';
}

export interface DifficultyAnalysis {
  currentRating: number;
  performanceByDifficulty: {
    easy: { attempts: number; accuracy: number };
    optimal: { attempts: number; accuracy: number };
    hard: { attempts: number; accuracy: number };
    stretch: { attempts: number; accuracy: number };
  };
  sweetSpot: {
    minDifficulty: number;
    maxDifficulty: number;
    targetWinRate: number;
  };
  recommendation: string;
}

// ============================================
// Time-based Adjustments
// ============================================

export interface TimingFactor {
  ratio: number;  // actual / budget
  category: 'very_fast' | 'fast' | 'normal' | 'slow' | 'very_slow';
  adjustment: number;  // Multiplier for ELO change
  description: string;
}

export interface SessionFatigue {
  questionsInSession: number;
  minutesElapsed: number;
  accuracyTrend: number[];
  fatigueLevel: 'fresh' | 'warmed_up' | 'optimal' | 'tired' | 'fatigued';
  recommendation: string;
}
