/**
 * ELO Rating Model
 * Glicko-2 inspired rating system for adaptive difficulty
 */

import { getDatabase, query, queryOne, saveDatabase } from '../db/connection.js';

// ============================================
// Types
// ============================================

export type ScopeType = 'global' | 'section' | 'topic' | 'atom';
export type MasteryLevel = 'unstarted' | 'learning' | 'practicing' | 'mastered' | 'reviewing';
export type StreakType = 'win' | 'loss' | null;

export interface EloRating {
  id: number;
  scope_type: ScopeType;
  scope_code: string | null;
  rating: number;
  rating_deviation: number;
  volatility: number;
  games_played: number;
  confidence_level: number;
  peak_rating: number;
  peak_date: string | null;
  last_5_results: boolean[];
  current_streak: number;
  streak_type: StreakType;
  created_at: string;
  updated_at: string;
}

export interface EloHistory {
  id: number;
  elo_rating_id: number;
  rating_before: number;
  rating_after: number;
  rating_change: number;
  deviation_before: number;
  deviation_after: number;
  attempt_id: number | null;
  question_difficulty: number | null;
  was_correct: boolean;
  expected_score: number;
  recorded_at: string;
}

export interface AtomMastery {
  id: number;
  atom_id: number;
  mastery_level: MasteryLevel;
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

export interface PerformanceBenchmark {
  id: number;
  scope_type: ScopeType;
  scope_code: string | null;
  percentile: number;
  rating_threshold: number;
  description: string | null;
  created_at: string;
}

// ============================================
// Constants
// ============================================

// ELO calculation constants
export const ELO_K_FACTOR = 32; // How much ratings change per game
export const ELO_DEFAULT_RATING = 500;
export const ELO_DEFAULT_DEVIATION = 350;
export const ELO_MIN_DEVIATION = 30;
export const ELO_MAX_DEVIATION = 500;

// Mastery gate thresholds
export const MASTERY_ACCURACY_THRESHOLD = 0.85; // 85% accuracy required
export const MASTERY_MIN_ATTEMPTS = 10; // At least 10 attempts
export const MASTERY_STREAK_THRESHOLD = 5; // 5 correct in a row

// ============================================
// Helper Functions
// ============================================

function parseEloRating(row: Record<string, unknown>): EloRating {
  return {
    id: row.id as number,
    scope_type: row.scope_type as ScopeType,
    scope_code: row.scope_code as string | null,
    rating: row.rating as number,
    rating_deviation: row.rating_deviation as number,
    volatility: row.volatility as number,
    games_played: row.games_played as number,
    confidence_level: row.confidence_level as number,
    peak_rating: row.peak_rating as number,
    peak_date: row.peak_date as string | null,
    last_5_results: JSON.parse(row.last_5_results as string || '[]'),
    current_streak: row.current_streak as number,
    streak_type: row.streak_type as StreakType,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseEloHistory(row: Record<string, unknown>): EloHistory {
  return {
    id: row.id as number,
    elo_rating_id: row.elo_rating_id as number,
    rating_before: row.rating_before as number,
    rating_after: row.rating_after as number,
    rating_change: row.rating_change as number,
    deviation_before: row.deviation_before as number,
    deviation_after: row.deviation_after as number,
    attempt_id: row.attempt_id as number | null,
    question_difficulty: row.question_difficulty as number | null,
    was_correct: row.was_correct === 1,
    expected_score: row.expected_score as number,
    recorded_at: row.recorded_at as string,
  };
}

function parseAtomMastery(row: Record<string, unknown>): AtomMastery {
  return {
    id: row.id as number,
    atom_id: row.atom_id as number,
    mastery_level: row.mastery_level as MasteryLevel,
    attempts_total: row.attempts_total as number,
    attempts_correct: row.attempts_correct as number,
    accuracy: row.accuracy as number,
    recent_accuracy: row.recent_accuracy as number,
    recent_attempts: JSON.parse(row.recent_attempts as string || '[]'),
    avg_time_seconds: row.avg_time_seconds as number | null,
    best_time_seconds: row.best_time_seconds as number | null,
    meets_accuracy_gate: row.meets_accuracy_gate === 1,
    meets_attempts_gate: row.meets_attempts_gate === 1,
    meets_streak_gate: row.meets_streak_gate === 1,
    first_attempt_at: row.first_attempt_at as string | null,
    last_attempt_at: row.last_attempt_at as string | null,
    mastered_at: row.mastered_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================
// ELO Calculation Functions
// ============================================

/**
 * Calculate expected score (probability of winning)
 * Uses logistic function from ELO formula
 */
export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate new ELO rating after a game
 */
export function calculateNewRating(
  currentRating: number,
  opponentRating: number,
  actualScore: number, // 1 for win, 0 for loss
  kFactor: number = ELO_K_FACTOR
): number {
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  const newRating = currentRating + kFactor * (actualScore - expectedScore);
  return Math.round(newRating);
}

/**
 * Calculate adaptive K-factor based on games played and rating deviation
 * Higher K for new players, lower for established ones
 */
export function getAdaptiveKFactor(gamesPlayed: number, ratingDeviation: number): number {
  // New players get higher K-factor for faster convergence
  if (gamesPlayed < 10) return 40;
  if (gamesPlayed < 30) return 32;
  if (gamesPlayed < 100) return 24;
  
  // Use deviation to adjust further
  const deviationFactor = Math.min(1, ratingDeviation / 100);
  return Math.max(16, 20 * deviationFactor);
}

/**
 * Update rating deviation (uncertainty decreases with more games)
 */
export function calculateNewDeviation(
  currentDeviation: number,
  gamesPlayed: number
): number {
  // Simple decay formula - deviation decreases as games increase
  const decay = Math.max(0.95, 1 - gamesPlayed / 500);
  const newDeviation = currentDeviation * decay;
  return Math.max(ELO_MIN_DEVIATION, Math.min(ELO_MAX_DEVIATION, Math.round(newDeviation)));
}

// ============================================
// ELO Rating Functions
// ============================================

export function getGlobalRating(): EloRating | null {
  const row = queryOne<Record<string, unknown>>(
    "SELECT * FROM elo_ratings WHERE scope_type = 'global' AND scope_code IS NULL"
  );
  return row ? parseEloRating(row) : null;
}

export function getSectionRating(sectionCode: string): EloRating | null {
  const row = queryOne<Record<string, unknown>>(
    "SELECT * FROM elo_ratings WHERE scope_type = 'section' AND scope_code = ?",
    [sectionCode]
  );
  return row ? parseEloRating(row) : null;
}

export function getTopicRating(topicCode: string): EloRating | null {
  const row = queryOne<Record<string, unknown>>(
    "SELECT * FROM elo_ratings WHERE scope_type = 'topic' AND scope_code = ?",
    [topicCode]
  );
  return row ? parseEloRating(row) : null;
}

export function getOrCreateRating(scopeType: ScopeType, scopeCode: string | null): EloRating {
  const db = getDatabase();
  
  let row = queryOne<Record<string, unknown>>(
    'SELECT * FROM elo_ratings WHERE scope_type = ? AND (scope_code = ? OR (scope_code IS NULL AND ? IS NULL))',
    [scopeType, scopeCode, scopeCode]
  );
  
  if (!row) {
    db.run(
      'INSERT INTO elo_ratings (scope_type, scope_code) VALUES (?, ?)',
      [scopeType, scopeCode]
    );
    saveDatabase();
    
    row = queryOne<Record<string, unknown>>(
      'SELECT * FROM elo_ratings WHERE scope_type = ? AND (scope_code = ? OR (scope_code IS NULL AND ? IS NULL))',
      [scopeType, scopeCode, scopeCode]
    );
  }
  
  return parseEloRating(row!);
}

export function updateRating(
  ratingId: number,
  questionDifficulty: number,
  wasCorrect: boolean,
  attemptId?: number
): EloRating {
  const db = getDatabase();
  
  // Get current rating
  const current = queryOne<Record<string, unknown>>(
    'SELECT * FROM elo_ratings WHERE id = ?',
    [ratingId]
  );
  if (!current) throw new Error('Rating not found');
  
  const currentRating = parseEloRating(current);
  const actualScore = wasCorrect ? 1 : 0;
  const expectedScore = calculateExpectedScore(currentRating.rating, questionDifficulty);
  const kFactor = getAdaptiveKFactor(currentRating.games_played, currentRating.rating_deviation);
  
  // Calculate new values
  const newRating = calculateNewRating(currentRating.rating, questionDifficulty, actualScore, kFactor);
  const newDeviation = calculateNewDeviation(currentRating.rating_deviation, currentRating.games_played + 1);
  const ratingChange = newRating - currentRating.rating;
  
  // Update streak
  let newStreak = currentRating.current_streak;
  let newStreakType = currentRating.streak_type;
  if (wasCorrect) {
    newStreak = currentRating.streak_type === 'win' ? currentRating.current_streak + 1 : 1;
    newStreakType = 'win';
  } else {
    newStreak = currentRating.streak_type === 'loss' ? currentRating.current_streak + 1 : 1;
    newStreakType = 'loss';
  }
  
  // Update last 5 results
  const last5 = [...currentRating.last_5_results, wasCorrect].slice(-5);
  
  // Check for new peak
  const isPeak = newRating > currentRating.peak_rating;
  
  // Record history
  db.run(`
    INSERT INTO elo_history (
      elo_rating_id, rating_before, rating_after, rating_change,
      deviation_before, deviation_after, attempt_id, question_difficulty,
      was_correct, expected_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    ratingId,
    currentRating.rating,
    newRating,
    ratingChange,
    currentRating.rating_deviation,
    newDeviation,
    attemptId ?? null,
    questionDifficulty,
    wasCorrect ? 1 : 0,
    expectedScore,
  ]);
  
  // Update rating
  db.run(`
    UPDATE elo_ratings SET
      rating = ?,
      rating_deviation = ?,
      games_played = games_played + 1,
      confidence_level = ?,
      peak_rating = ?,
      peak_date = CASE WHEN ? THEN datetime('now') ELSE peak_date END,
      last_5_results = ?,
      current_streak = ?,
      streak_type = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [
    newRating,
    newDeviation,
    Math.min(1, (currentRating.games_played + 1) / 100), // Confidence increases with games
    isPeak ? newRating : currentRating.peak_rating,
    isPeak ? 1 : 0,
    JSON.stringify(last5),
    newStreak,
    newStreakType,
    ratingId,
  ]);
  
  saveDatabase();
  
  return getOrCreateRating(currentRating.scope_type, currentRating.scope_code);
}

export function getRatingHistory(ratingId: number, limit: number = 100): EloHistory[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM elo_history WHERE elo_rating_id = ? ORDER BY recorded_at DESC LIMIT ?',
    [ratingId, limit]
  );
  return rows.map(parseEloHistory);
}

// ============================================
// Atom Mastery Functions
// ============================================

export function getAtomMastery(atomId: number): AtomMastery | null {
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM atom_mastery WHERE atom_id = ?',
    [atomId]
  );
  return row ? parseAtomMastery(row) : null;
}

export function getOrCreateAtomMastery(atomId: number): AtomMastery {
  const db = getDatabase();
  
  let mastery = getAtomMastery(atomId);
  if (!mastery) {
    db.run('INSERT INTO atom_mastery (atom_id) VALUES (?)', [atomId]);
    saveDatabase();
    mastery = getAtomMastery(atomId)!;
  }
  
  return mastery;
}

export function updateAtomMastery(
  atomId: number,
  wasCorrect: boolean,
  timeSeconds: number
): AtomMastery {
  const db = getDatabase();
  const mastery = getOrCreateAtomMastery(atomId);
  
  // Update basic counts
  const newTotal = mastery.attempts_total + 1;
  const newCorrect = mastery.attempts_correct + (wasCorrect ? 1 : 0);
  const newAccuracy = newCorrect / newTotal;
  
  // Update recent attempts (rolling window of 10)
  const recentAttempts = [...mastery.recent_attempts, wasCorrect].slice(-10);
  const recentCorrect = recentAttempts.filter(Boolean).length;
  const recentAccuracy = recentAttempts.length > 0 ? recentCorrect / recentAttempts.length : 0;
  
  // Update time metrics
  const newAvgTime = mastery.avg_time_seconds === null
    ? timeSeconds
    : (mastery.avg_time_seconds * mastery.attempts_total + timeSeconds) / newTotal;
  const newBestTime = mastery.best_time_seconds === null
    ? (wasCorrect ? timeSeconds : null)
    : (wasCorrect && timeSeconds < mastery.best_time_seconds ? timeSeconds : mastery.best_time_seconds);
  
  // Check mastery gates
  const meetsAccuracyGate = recentAccuracy >= MASTERY_ACCURACY_THRESHOLD && recentAttempts.length >= 5;
  const meetsAttemptsGate = newTotal >= MASTERY_MIN_ATTEMPTS;
  
  // Check streak gate (last N correct)
  let currentStreak = 0;
  for (let i = recentAttempts.length - 1; i >= 0 && recentAttempts[i]; i--) {
    currentStreak++;
  }
  const meetsStreakGate = currentStreak >= MASTERY_STREAK_THRESHOLD;
  
  // Determine mastery level
  let masteryLevel: MasteryLevel = mastery.mastery_level;
  const allGatesMet = meetsAccuracyGate && meetsAttemptsGate && meetsStreakGate;
  
  if (masteryLevel === 'unstarted') {
    masteryLevel = 'learning';
  } else if (masteryLevel === 'learning' && newTotal >= 5) {
    masteryLevel = 'practicing';
  } else if (masteryLevel === 'practicing' && allGatesMet) {
    masteryLevel = 'mastered';
  } else if (masteryLevel === 'mastered' && recentAccuracy < 0.7) {
    masteryLevel = 'reviewing';
  } else if (masteryLevel === 'reviewing' && allGatesMet) {
    masteryLevel = 'mastered';
  }
  
  const justMastered = masteryLevel === 'mastered' && mastery.mastery_level !== 'mastered';
  
  // Update database
  db.run(`
    UPDATE atom_mastery SET
      mastery_level = ?,
      attempts_total = ?,
      attempts_correct = ?,
      accuracy = ?,
      recent_accuracy = ?,
      recent_attempts = ?,
      avg_time_seconds = ?,
      best_time_seconds = ?,
      meets_accuracy_gate = ?,
      meets_attempts_gate = ?,
      meets_streak_gate = ?,
      first_attempt_at = COALESCE(first_attempt_at, datetime('now')),
      last_attempt_at = datetime('now'),
      mastered_at = CASE WHEN ? THEN datetime('now') ELSE mastered_at END,
      updated_at = datetime('now')
    WHERE atom_id = ?
  `, [
    masteryLevel,
    newTotal,
    newCorrect,
    newAccuracy,
    recentAccuracy,
    JSON.stringify(recentAttempts),
    newAvgTime,
    newBestTime,
    meetsAccuracyGate ? 1 : 0,
    meetsAttemptsGate ? 1 : 0,
    meetsStreakGate ? 1 : 0,
    justMastered ? 1 : 0,
    atomId,
  ]);
  
  saveDatabase();
  
  return getAtomMastery(atomId)!;
}

export function getMasteredAtoms(): AtomMastery[] {
  const rows = query<Record<string, unknown>>(
    "SELECT * FROM atom_mastery WHERE mastery_level = 'mastered'"
  );
  return rows.map(parseAtomMastery);
}

export function getAtomsByMasteryLevel(level: MasteryLevel): AtomMastery[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM atom_mastery WHERE mastery_level = ?',
    [level]
  );
  return rows.map(parseAtomMastery);
}

export function getAllAtomMastery(): AtomMastery[] {
  const rows = query<Record<string, unknown>>('SELECT * FROM atom_mastery');
  return rows.map(parseAtomMastery);
}

// ============================================
// Benchmark Functions
// ============================================

export function getBenchmarks(scopeType: ScopeType = 'global', scopeCode: string | null = null): PerformanceBenchmark[] {
  return query<PerformanceBenchmark>(
    'SELECT * FROM performance_benchmarks WHERE scope_type = ? AND (scope_code = ? OR (scope_code IS NULL AND ? IS NULL)) ORDER BY percentile DESC',
    [scopeType, scopeCode, scopeCode]
  );
}

export function getPercentileForRating(rating: number, scopeType: ScopeType = 'global', scopeCode: string | null = null): number {
  const benchmarks = getBenchmarks(scopeType, scopeCode);
  
  for (const benchmark of benchmarks) {
    if (rating >= benchmark.rating_threshold) {
      return benchmark.percentile;
    }
  }
  
  return 0;
}

export function getRatingForPercentile(percentile: number, scopeType: ScopeType = 'global', scopeCode: string | null = null): number | null {
  const row = queryOne<{ rating_threshold: number }>(
    'SELECT rating_threshold FROM performance_benchmarks WHERE scope_type = ? AND (scope_code = ? OR (scope_code IS NULL AND ? IS NULL)) AND percentile = ?',
    [scopeType, scopeCode, scopeCode, percentile]
  );
  return row?.rating_threshold ?? null;
}

// ============================================
// Statistics Functions
// ============================================

export function getMasteryStats(): {
  total: number;
  mastered: number;
  learning: number;
  practicing: number;
  reviewing: number;
  unstarted: number;
  masteryRate: number;
} {
  const rows = query<{ mastery_level: MasteryLevel; count: number }>(`
    SELECT mastery_level, COUNT(*) as count
    FROM atom_mastery
    GROUP BY mastery_level
  `);
  
  const stats = {
    total: 0,
    mastered: 0,
    learning: 0,
    practicing: 0,
    reviewing: 0,
    unstarted: 0,
    masteryRate: 0,
  };
  
  for (const row of rows) {
    stats[row.mastery_level] = row.count;
    stats.total += row.count;
  }
  
  stats.masteryRate = stats.total > 0 ? stats.mastered / stats.total : 0;
  
  return stats;
}

export function getRatingTrend(ratingId: number, days: number = 30): Array<{ date: string; rating: number }> {
  return query<{ date: string; rating: number }>(`
    SELECT date(recorded_at) as date, AVG(rating_after) as rating
    FROM elo_history
    WHERE elo_rating_id = ? AND recorded_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(recorded_at)
    ORDER BY date
  `, [ratingId, days]);
}
