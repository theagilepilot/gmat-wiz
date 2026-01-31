/**
 * Question Selection Service
 * Adaptive difficulty engine using ELO-based question matching
 */

import {
  Question,
  getQuestionsForDifficulty,
  getUnattemptedQuestions,
  getQuestionsBySection,
  getQuestionById,
  getQuestionsByAtom,
} from '../models/Question.js';
import {
  getGlobalRating,
  getSectionRating,
  getOrCreateRating,
  calculateExpectedScore,
  ELO_DEFAULT_RATING,
} from '../models/EloRating.js';
import { getDueReviews, type ReviewQueueItem } from '../models/Scheduling.js';
import { query } from '../db/connection.js';

// ============================================
// Types
// ============================================

export type SelectionMode = 'build' | 'prove' | 'review' | 'diagnostic';

export interface QuestionSelectionCriteria {
  mode: SelectionMode;
  sectionCode?: string;
  targetAtomIds?: number[];
  excludeQuestionIds?: number[];
  count?: number;
}

export interface SelectedQuestion {
  question: Question;
  reason: string;
  expectedScore: number;
  difficultyMatch: 'easy' | 'optimal' | 'hard' | 'stretch';
}

export interface DifficultyBand {
  min: number;
  max: number;
  label: string;
}

// ============================================
// Constants
// ============================================

// Difficulty bands relative to user's ELO
export const DIFFICULTY_BANDS = {
  // Build mode: slightly below user level for confidence building
  build: { offset: -100, range: 150 }, // User ELO - 100 ± 75
  
  // Prove mode: at or slightly above user level
  prove: { offset: 0, range: 100 }, // User ELO ± 50
  
  // Review mode: varies based on item, typically easier
  review: { offset: -50, range: 100 }, // User ELO - 50 ± 50
  
  // Diagnostic: wide range to assess true level
  diagnostic: { offset: 0, range: 300 }, // User ELO ± 150
};

// Target win rates for each mode (percentage)
export const TARGET_WIN_RATES = {
  build: 0.75, // 75% expected win rate - confidence building
  prove: 0.55, // 55% expected win rate - challenging but achievable
  review: 0.80, // 80% expected win rate - reinforce mastery
  diagnostic: 0.50, // 50% expected - true assessment
};

// ============================================
// Pure Calculation Functions (for testing)
// ============================================

/**
 * Calculate the optimal difficulty range for a given user ELO and mode
 */
export function calculateDifficultyRange(
  userElo: number,
  mode: SelectionMode
): DifficultyBand {
  const band = DIFFICULTY_BANDS[mode];
  const center = userElo + band.offset;
  const halfRange = band.range / 2;
  
  return {
    min: Math.max(100, Math.round(center - halfRange)),
    max: Math.min(900, Math.round(center + halfRange)),
    label: mode,
  };
}

/**
 * Score how well a question's difficulty matches the user's ELO for the given mode
 * Returns a value between 0-100 where 100 is perfect match
 */
export function scoreDifficultyMatch(
  questionDifficulty: number,
  userElo: number,
  mode: SelectionMode
): number {
  const targetWinRate = TARGET_WIN_RATES[mode];
  const actualExpectedScore = calculateExpectedScore(userElo, questionDifficulty);
  
  // How close is the actual win rate to the target?
  const difference = Math.abs(actualExpectedScore - targetWinRate);
  
  // Convert to 0-100 score (0 difference = 100 score)
  return Math.round(Math.max(0, 100 - difference * 200));
}

/**
 * Categorize the difficulty match
 */
export function categorizeDifficultyMatch(
  questionDifficulty: number,
  userElo: number
): 'easy' | 'optimal' | 'hard' | 'stretch' {
  const eloDiff = questionDifficulty - userElo;
  
  if (eloDiff < -100) return 'easy';
  if (eloDiff >= -100 && eloDiff <= 100) return 'optimal';
  if (eloDiff > 100 && eloDiff <= 200) return 'hard';
  return 'stretch';
}

/**
 * Calculate priority score for a question based on multiple factors
 */
export function calculateQuestionPriority(
  question: Question,
  userElo: number,
  mode: SelectionMode,
  isReviewItem: boolean = false,
  targetAtomIds: number[] = []
): number {
  let priority = 0;
  
  // Base: difficulty match score (0-100)
  priority += scoreDifficultyMatch(question.difficulty_rating, userElo, mode);
  
  // Bonus for review items
  if (isReviewItem) {
    priority += 30;
  }
  
  // Bonus for targeting specific atoms (would need atom linkage)
  // This would be applied after filtering
  
  // Penalty for frequently served questions
  if (question.times_served > 5) {
    priority -= Math.min(20, question.times_served * 2);
  }
  
  // Bonus for verified questions
  if (question.is_verified) {
    priority += 10;
  }
  
  // Bonus for high quality score
  if (question.quality_score && question.quality_score > 4) {
    priority += 10;
  }
  
  return priority;
}

// ============================================
// Service Functions
// ============================================

/**
 * Get the user's current ELO for the given context
 */
export function getUserEloForContext(sectionCode?: string): number {
  if (sectionCode) {
    const sectionRating = getSectionRating(sectionCode);
    if (sectionRating) return sectionRating.rating;
  }
  
  const globalRating = getGlobalRating();
  return globalRating?.rating ?? ELO_DEFAULT_RATING;
}

/**
 * Select questions based on criteria with adaptive difficulty
 */
export function selectQuestions(criteria: QuestionSelectionCriteria): SelectedQuestion[] {
  const count = criteria.count ?? 1;
  const userElo = getUserEloForContext(criteria.sectionCode);
  const difficultyRange = calculateDifficultyRange(userElo, criteria.mode);
  
  // Get candidate questions
  let candidates: Question[] = [];
  
  if (criteria.targetAtomIds && criteria.targetAtomIds.length > 0) {
    // Get questions for specific atoms
    for (const atomId of criteria.targetAtomIds) {
      const atomQuestions = getQuestionsByAtom(atomId);
      candidates.push(...atomQuestions);
    }
    // Remove duplicates
    candidates = [...new Map(candidates.map(q => [q.id, q])).values()];
  } else if (criteria.sectionCode) {
    // Get questions from difficulty range
    candidates = getQuestionsForDifficulty(
      criteria.sectionCode,
      difficultyRange.min,
      difficultyRange.max,
      count * 3 // Get more than needed for selection
    );
    
    // If not enough in range, expand search
    if (candidates.length < count) {
      const additional = getQuestionsBySection(criteria.sectionCode, count * 2);
      candidates = [...candidates, ...additional];
      candidates = [...new Map(candidates.map(q => [q.id, q])).values()];
    }
  } else {
    // Get from any section in difficulty range
    const sections = ['quant', 'verbal', 'ir'];
    for (const section of sections) {
      const sectionQuestions = getQuestionsForDifficulty(
        section,
        difficultyRange.min,
        difficultyRange.max,
        Math.ceil(count / sections.length) * 2
      );
      candidates.push(...sectionQuestions);
    }
  }
  
  // Filter out excluded questions
  if (criteria.excludeQuestionIds && criteria.excludeQuestionIds.length > 0) {
    const excludeSet = new Set(criteria.excludeQuestionIds);
    candidates = candidates.filter(q => !excludeSet.has(q.id));
  }
  
  // Score and rank candidates
  const scoredCandidates = candidates.map(question => ({
    question,
    priority: calculateQuestionPriority(question, userElo, criteria.mode),
    expectedScore: calculateExpectedScore(userElo, question.difficulty_rating),
    difficultyMatch: categorizeDifficultyMatch(question.difficulty_rating, userElo),
  }));
  
  // Sort by priority (highest first)
  scoredCandidates.sort((a, b) => b.priority - a.priority);
  
  // Select top N with some randomization to avoid predictability
  const selected: SelectedQuestion[] = [];
  const topCandidates = scoredCandidates.slice(0, Math.min(count * 2, scoredCandidates.length));
  
  for (let i = 0; i < count && topCandidates.length > 0; i++) {
    // Pick from top candidates with weighted randomness
    const index = Math.floor(Math.random() * Math.min(3, topCandidates.length));
    const chosen = topCandidates.splice(index, 1)[0];
    
    if (chosen) {
      selected.push({
        question: chosen.question,
        reason: generateSelectionReason(chosen.question, userElo, criteria.mode),
        expectedScore: chosen.expectedScore,
        difficultyMatch: chosen.difficultyMatch,
      });
    }
  }
  
  return selected;
}

/**
 * Generate a human-readable reason for why a question was selected
 */
function generateSelectionReason(
  question: Question,
  userElo: number,
  mode: SelectionMode
): string {
  const difficultyMatch = categorizeDifficultyMatch(question.difficulty_rating, userElo);
  const expectedWin = Math.round(calculateExpectedScore(userElo, question.difficulty_rating) * 100);
  
  const modeDescriptions = {
    build: 'Building confidence',
    prove: 'Testing mastery',
    review: 'Reinforcing knowledge',
    diagnostic: 'Assessing level',
  };
  
  const difficultyDescriptions = {
    easy: 'comfortable difficulty',
    optimal: 'well-matched to your level',
    hard: 'a good challenge',
    stretch: 'pushing your limits',
  };
  
  return `${modeDescriptions[mode]}: ${difficultyDescriptions[difficultyMatch]} (${expectedWin}% win rate)`;
}

/**
 * Get the next question for the user based on their current context
 */
export function getNextQuestion(
  mode: SelectionMode = 'build',
  sectionCode?: string,
  currentSessionQuestionIds: number[] = []
): SelectedQuestion | null {
  // First check review queue if in review mode
  if (mode === 'review') {
    const dueItems: ReviewQueueItem[] = getDueReviews(5);
    if (dueItems.length > 0) {
      // Get questions for review items
      const reviewQuestionIds = dueItems
        .filter((item: ReviewQueueItem) => item.item_type === 'question')
        .map((item: ReviewQueueItem) => item.item_id);
      
      for (const qId of reviewQuestionIds) {
        if (!currentSessionQuestionIds.includes(qId)) {
          const question = getQuestionById(qId);
          if (question) {
            const userElo = getUserEloForContext(question.section_code);
            return {
              question,
              reason: 'Due for review based on spaced repetition schedule',
              expectedScore: calculateExpectedScore(userElo, question.difficulty_rating),
              difficultyMatch: categorizeDifficultyMatch(question.difficulty_rating, userElo),
            };
          }
        }
      }
    }
  }
  
  // Otherwise use normal selection
  const selected = selectQuestions({
    mode,
    sectionCode,
    excludeQuestionIds: currentSessionQuestionIds,
    count: 1,
  });
  
  return selected[0] ?? null;
}

/**
 * Check if a question's difficulty is appropriate for the user
 */
export function isQuestionAppropriate(
  questionId: number,
  mode: SelectionMode,
  sectionCode?: string
): { appropriate: boolean; reason: string } {
  const question = getQuestionById(questionId);
  if (!question) {
    return { appropriate: false, reason: 'Question not found' };
  }
  
  const userElo = getUserEloForContext(sectionCode ?? question.section_code);
  const difficultyMatch = categorizeDifficultyMatch(question.difficulty_rating, userElo);
  const expectedScore = calculateExpectedScore(userElo, question.difficulty_rating);
  
  // In build mode, reject questions that are too hard
  if (mode === 'build' && expectedScore < 0.5) {
    return {
      appropriate: false,
      reason: `Question is too difficult for build mode (${Math.round(expectedScore * 100)}% expected win rate)`,
    };
  }
  
  // In prove mode, reject questions that are too easy
  if (mode === 'prove' && expectedScore > 0.85) {
    return {
      appropriate: false,
      reason: `Question is too easy for prove mode (${Math.round(expectedScore * 100)}% expected win rate)`,
    };
  }
  
  return {
    appropriate: true,
    reason: `Good match: ${difficultyMatch} difficulty (${Math.round(expectedScore * 100)}% expected win rate)`,
  };
}
