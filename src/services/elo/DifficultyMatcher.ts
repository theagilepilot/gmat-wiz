/**
 * Difficulty Matcher
 * Matches questions to user skill level with smart targeting
 */

import type { Question } from '../../models/Question.js';
import { calculateExpectedWinRate } from './EloCalculator.js';
import {
  TARGET_WIN_RATES,
  DIFFICULTY_OFFSETS,
  DIFFICULTY_SPREADS,
  MIN_RATING,
  MAX_RATING,
} from './constants.js';
import type { SelectionMode } from './QuestionSelector.js';

// ============================================
// Types
// ============================================

export interface DifficultyBand {
  name: string;
  minElo: number;
  maxElo: number;
  label: string;
  description: string;
}

export interface MatchResult {
  question: Question;
  matchQuality: 'excellent' | 'good' | 'fair' | 'poor';
  matchScore: number;  // 0-100
  expectedWinRate: number;
  eloDifference: number;
  explanation: string;
}

export interface DifficultyRecommendation {
  targetDifficulty: number;
  minDifficulty: number;
  maxDifficulty: number;
  reason: string;
}

// ============================================
// Difficulty Bands
// ============================================

/**
 * Define standard difficulty bands
 */
export function getDifficultyBands(): DifficultyBand[] {
  return [
    { name: 'foundational', minElo: 100, maxElo: 250, label: 'Foundational', description: 'Basic concepts and warm-up' },
    { name: 'developing', minElo: 250, maxElo: 400, label: 'Developing', description: 'Building core skills' },
    { name: 'competent', minElo: 400, maxElo: 550, label: 'Competent', description: 'Solid understanding' },
    { name: 'proficient', minElo: 550, maxElo: 650, label: 'Proficient', description: 'Strong performer' },
    { name: 'advanced', minElo: 650, maxElo: 750, label: 'Advanced', description: 'High-level mastery' },
    { name: 'expert', minElo: 750, maxElo: 900, label: 'Expert', description: 'Top-tier performance' },
  ];
}

/**
 * Get the difficulty band for a rating
 */
export function getBandForRating(rating: number): DifficultyBand {
  const bands = getDifficultyBands();
  
  for (const band of bands) {
    if (rating >= band.minElo && rating < band.maxElo) {
      return band;
    }
  }
  
  // Edge cases
  if (rating < 100) return bands[0];
  return bands[bands.length - 1];
}

/**
 * Get the band for a question difficulty
 */
export function getQuestionBand(question: Question): DifficultyBand {
  return getBandForRating(question.difficulty_rating);
}

// ============================================
// Matching Functions
// ============================================

/**
 * Calculate how well a question matches the user's target
 */
export function calculateMatchScore(
  questionDifficulty: number,
  userElo: number,
  mode: SelectionMode
): number {
  const targetWinRate = TARGET_WIN_RATES[mode];
  const actualWinRate = calculateExpectedWinRate(userElo, questionDifficulty);
  
  // Calculate difference from target
  const winRateDiff = Math.abs(actualWinRate - targetWinRate);
  
  // Convert to 0-100 score (perfect match = 100)
  // 0.1 difference = 80 score, 0.2 difference = 60 score, etc.
  const score = Math.max(0, 100 - winRateDiff * 200);
  
  return Math.round(score);
}

/**
 * Get match quality label
 */
export function getMatchQuality(
  matchScore: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (matchScore >= 85) return 'excellent';
  if (matchScore >= 70) return 'good';
  if (matchScore >= 50) return 'fair';
  return 'poor';
}

/**
 * Full match analysis for a question
 */
export function analyzeMatch(
  question: Question,
  userElo: number,
  mode: SelectionMode
): MatchResult {
  const matchScore = calculateMatchScore(question.difficulty_rating, userElo, mode);
  const matchQuality = getMatchQuality(matchScore);
  const expectedWinRate = calculateExpectedWinRate(userElo, question.difficulty_rating);
  const eloDifference = question.difficulty_rating - userElo;
  
  let explanation: string;
  
  if (matchQuality === 'excellent') {
    explanation = `Perfect difficulty match for ${mode} mode`;
  } else if (matchQuality === 'good') {
    if (eloDifference > 0) {
      explanation = `Good challenge - slightly above your level`;
    } else {
      explanation = `Good practice - slightly below your level`;
    }
  } else if (matchQuality === 'fair') {
    if (eloDifference > 100) {
      explanation = `Challenging - significantly above current level`;
    } else if (eloDifference < -100) {
      explanation = `Easy - good for building confidence`;
    } else {
      explanation = `Acceptable match for practice`;
    }
  } else {
    if (eloDifference > 150) {
      explanation = `Very difficult - may want easier questions first`;
    } else {
      explanation = `Too easy - limited learning value`;
    }
  }
  
  return {
    question,
    matchQuality,
    matchScore,
    expectedWinRate,
    eloDifference,
    explanation,
  };
}

// ============================================
// Recommendation Engine
// ============================================

/**
 * Get recommended difficulty for user and mode
 */
export function getRecommendedDifficulty(
  userElo: number,
  mode: SelectionMode
): DifficultyRecommendation {
  const offset = DIFFICULTY_OFFSETS[mode];
  const spread = DIFFICULTY_SPREADS[mode];
  
  const target = Math.max(MIN_RATING, Math.min(MAX_RATING, userElo + offset));
  const min = Math.max(MIN_RATING, target - spread);
  const max = Math.min(MAX_RATING, target + spread);
  
  const reasonMap = {
    build: 'Targeting slightly easier questions to build confidence and momentum',
    prove: 'Targeting questions at your level to test true mastery',
    review: 'Targeting comfortable questions for knowledge reinforcement',
    diagnostic: 'Wide range to accurately assess your current level',
  };
  
  return {
    targetDifficulty: target,
    minDifficulty: min,
    maxDifficulty: max,
    reason: reasonMap[mode],
  };
}

/**
 * Find optimal difficulty for a target win rate
 */
export function findDifficultyForWinRate(
  userElo: number,
  targetWinRate: number
): number {
  // Use ELO formula inverse
  // E = 1 / (1 + 10^((Rd - Rp)/400))
  // Solving for Rd: Rd = Rp + 400 * log10((1-E)/E)
  
  // Clamp target to valid range
  const clampedTarget = Math.max(0.1, Math.min(0.9, targetWinRate));
  
  const difficulty = userElo + 400 * Math.log10((1 - clampedTarget) / clampedTarget);
  
  return Math.round(Math.max(MIN_RATING, Math.min(MAX_RATING, difficulty)));
}

/**
 * Check if question is appropriate for mode
 */
export function isQuestionAppropriate(
  question: Question,
  userElo: number,
  mode: SelectionMode
): { appropriate: boolean; reason: string } {
  const match = analyzeMatch(question, userElo, mode);
  
  // Build mode: reject questions that are too hard
  if (mode === 'build' && match.expectedWinRate < 0.5) {
    return {
      appropriate: false,
      reason: `Question is too difficult for build mode (${Math.round(match.expectedWinRate * 100)}% expected success)`,
    };
  }
  
  // Prove mode: reject questions that are too easy
  if (mode === 'prove' && match.expectedWinRate > 0.85) {
    return {
      appropriate: false,
      reason: `Question is too easy for prove mode (${Math.round(match.expectedWinRate * 100)}% expected success)`,
    };
  }
  
  // Review mode: reject very hard questions
  if (mode === 'review' && match.expectedWinRate < 0.6) {
    return {
      appropriate: false,
      reason: `Question is too challenging for review (${Math.round(match.expectedWinRate * 100)}% expected success)`,
    };
  }
  
  return {
    appropriate: true,
    reason: match.explanation,
  };
}

// ============================================
// Batch Analysis
// ============================================

/**
 * Sort questions by match quality
 */
export function sortByMatchQuality(
  questions: Question[],
  userElo: number,
  mode: SelectionMode
): MatchResult[] {
  const results = questions.map(q => analyzeMatch(q, userElo, mode));
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

/**
 * Filter questions to appropriate difficulty
 */
export function filterByAppropriateness(
  questions: Question[],
  userElo: number,
  mode: SelectionMode
): Question[] {
  return questions.filter(q => 
    isQuestionAppropriate(q, userElo, mode).appropriate
  );
}

/**
 * Get difficulty distribution of a question set
 */
export function analyzeDifficultyDistribution(
  questions: Question[]
): Record<string, number> {
  const bands = getDifficultyBands();
  const distribution: Record<string, number> = {};
  
  for (const band of bands) {
    distribution[band.name] = 0;
  }
  
  for (const question of questions) {
    const band = getQuestionBand(question);
    distribution[band.name]++;
  }
  
  return distribution;
}

// ============================================
// Singleton Export
// ============================================

let matcherInstance: DifficultyMatcher | null = null;

export class DifficultyMatcher {
  getDifficultyBands = getDifficultyBands;
  getBandForRating = getBandForRating;
  getQuestionBand = getQuestionBand;
  calculateMatchScore = calculateMatchScore;
  getMatchQuality = getMatchQuality;
  analyzeMatch = analyzeMatch;
  getRecommendedDifficulty = getRecommendedDifficulty;
  findDifficultyForWinRate = findDifficultyForWinRate;
  isQuestionAppropriate = isQuestionAppropriate;
  sortByMatchQuality = sortByMatchQuality;
  filterByAppropriateness = filterByAppropriateness;
  analyzeDifficultyDistribution = analyzeDifficultyDistribution;
}

export function getDifficultyMatcher(): DifficultyMatcher {
  if (!matcherInstance) {
    matcherInstance = new DifficultyMatcher();
  }
  return matcherInstance;
}
