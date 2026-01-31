/**
 * Adaptive Question Selector
 * ELO-based question selection with weakness targeting and exploration
 */

import type { Question } from '../../models/Question.js';
import {
  getQuestionsForDifficulty,
  getQuestionsBySection,
  getQuestionsByAtom,
  getQuestionById,
} from '../../models/Question.js';
import {
  getOrCreateRating,
  getSectionRating,
  getGlobalRating,
  calculateExpectedScore,
  getAtomsByMasteryLevel,
  ELO_DEFAULT_RATING,
} from '../../models/EloRating.js';
import { getDueReviews, type ReviewQueueItem } from '../../models/Scheduling.js';
import {
  SELECTION_DISTRIBUTION,
  TARGET_WIN_RATES,
  DIFFICULTY_OFFSETS,
  DIFFICULTY_SPREADS,
  MIN_RATING,
  MAX_RATING,
} from './constants.js';
import { calculateExpectedWinRate } from './EloCalculator.js';

// ============================================
// Types
// ============================================

export type SelectionMode = 'build' | 'prove' | 'review' | 'diagnostic';
export type SelectionReason = 'near_rating' | 'stretch' | 'weakness' | 'random' | 'review_due' | 'specific_request';

export interface SelectionCriteria {
  mode: SelectionMode;
  sectionCode?: string;
  questionTypeCode?: string;
  targetAtomIds?: number[];
  excludeQuestionIds?: number[];
  count?: number;
  weaknessAtomIds?: number[];
}

export interface DifficultyTarget {
  center: number;
  min: number;
  max: number;
  targetWinRate: number;
}

export interface SelectionCandidate {
  question: Question;
  score: number;
  expectedWinRate: number;
  difficultyMatch: 'easy' | 'optimal' | 'hard' | 'stretch';
  selectionReason: SelectionReason;
}

export interface SelectedQuestion {
  question: Question;
  expectedWinRate: number;
  difficultyMatch: 'easy' | 'optimal' | 'hard' | 'stretch';
  selectionReason: SelectionReason;
  explanation: string;
}

export interface SelectionPlan {
  nearRatingCount: number;
  stretchCount: number;
  weaknessCount: number;
  randomCount: number;
}

// ============================================
// Core Selection Logic
// ============================================

/**
 * Calculate difficulty target for user and mode
 */
export function calculateDifficultyTarget(
  userElo: number,
  mode: SelectionMode
): DifficultyTarget {
  const offset = DIFFICULTY_OFFSETS[mode];
  const spread = DIFFICULTY_SPREADS[mode];
  const center = userElo + offset;
  
  return {
    center: Math.max(MIN_RATING, Math.min(MAX_RATING, center)),
    min: Math.max(MIN_RATING, center - spread),
    max: Math.min(MAX_RATING, center + spread),
    targetWinRate: TARGET_WIN_RATES[mode],
  };
}

/**
 * Categorize how a question's difficulty matches the user
 */
export function categorizeDifficulty(
  questionDifficulty: number,
  userElo: number
): 'easy' | 'optimal' | 'hard' | 'stretch' {
  const diff = questionDifficulty - userElo;
  
  if (diff < -100) return 'easy';
  if (diff >= -100 && diff <= 100) return 'optimal';
  if (diff > 100 && diff <= 200) return 'hard';
  return 'stretch';
}

/**
 * Score a question for selection (higher = better match)
 */
export function scoreQuestion(
  question: Question,
  userElo: number,
  mode: SelectionMode,
  criteria: SelectionCriteria
): SelectionCandidate {
  let score = 0;
  let selectionReason: SelectionReason = 'near_rating';
  
  const expectedWinRate = calculateExpectedWinRate(userElo, question.difficulty_rating);
  const targetWinRate = TARGET_WIN_RATES[mode];
  const difficultyMatch = categorizeDifficulty(question.difficulty_rating, userElo);
  
  // Base score: how close to target win rate (0-50 points)
  const winRateDiff = Math.abs(expectedWinRate - targetWinRate);
  score += Math.max(0, 50 - winRateDiff * 100);
  
  // Difficulty match bonus (0-30 points)
  if (mode === 'build' && difficultyMatch === 'easy') {
    score += 30;  // Build mode prefers easier
  } else if (mode === 'prove' && difficultyMatch === 'optimal') {
    score += 30;  // Prove mode wants exact match
  } else if (mode === 'review' && difficultyMatch === 'easy') {
    score += 25;  // Review likes comfortable
  } else if (mode === 'diagnostic' && difficultyMatch === 'optimal') {
    score += 30;  // Diagnostic wants true level
  }
  
  // Stretch bonus for prove mode
  if (mode === 'prove' && (difficultyMatch === 'hard' || difficultyMatch === 'stretch')) {
    score += 15;
    selectionReason = 'stretch';
  }
  
  // Weakness targeting bonus
  if (criteria.weaknessAtomIds && criteria.weaknessAtomIds.length > 0) {
    // Would need question-atom linkage to check this properly
    // For now, just mark if targeting specific atoms
    if (criteria.targetAtomIds && criteria.targetAtomIds.length > 0) {
      score += 20;
      selectionReason = 'weakness';
    }
  }
  
  // Freshness bonus (less served = better)
  if (question.times_served === 0) {
    score += 15;
  } else if (question.times_served < 3) {
    score += 10;
  } else if (question.times_served > 10) {
    score -= 10;  // Penalty for overused questions
  }
  
  // Quality bonuses
  if (question.is_verified) {
    score += 10;
  }
  if (question.quality_score && question.quality_score >= 4.5) {
    score += 10;
  } else if (question.quality_score && question.quality_score >= 4.0) {
    score += 5;
  }
  
  // Source preference
  if (question.source === 'seeded') {
    score += 10;  // Official/seeded questions get bonus
  }
  
  return {
    question,
    score,
    expectedWinRate,
    difficultyMatch,
    selectionReason,
  };
}

/**
 * Calculate selection plan (how many of each type to select)
 */
export function calculateSelectionPlan(
  count: number,
  mode: SelectionMode
): SelectionPlan {
  // Review mode has different distribution
  if (mode === 'review') {
    return {
      nearRatingCount: Math.ceil(count * 0.70),
      stretchCount: 0,
      weaknessCount: Math.ceil(count * 0.20),
      randomCount: Math.ceil(count * 0.10),
    };
  }
  
  // Diagnostic mode wants balanced assessment
  if (mode === 'diagnostic') {
    return {
      nearRatingCount: Math.ceil(count * 0.40),
      stretchCount: Math.ceil(count * 0.30),
      weaknessCount: Math.ceil(count * 0.20),
      randomCount: Math.ceil(count * 0.10),
    };
  }
  
  // Standard distribution for build/prove
  return {
    nearRatingCount: Math.ceil(count * SELECTION_DISTRIBUTION.NEAR_RATING),
    stretchCount: Math.ceil(count * SELECTION_DISTRIBUTION.STRETCH),
    weaknessCount: Math.ceil(count * SELECTION_DISTRIBUTION.WEAKNESS),
    randomCount: Math.ceil(count * SELECTION_DISTRIBUTION.RANDOM),
  };
}

// ============================================
// Question Fetching
// ============================================

/**
 * Get user's ELO for the given context
 */
export function getUserElo(sectionCode?: string): number {
  if (sectionCode) {
    const sectionRating = getSectionRating(sectionCode);
    if (sectionRating) return sectionRating.rating;
  }
  
  const globalRating = getGlobalRating();
  return globalRating?.rating ?? ELO_DEFAULT_RATING;
}

/**
 * Fetch candidate questions from database
 */
export function fetchCandidateQuestions(
  criteria: SelectionCriteria,
  difficultyTarget: DifficultyTarget,
  limit: number = 50
): Question[] {
  let candidates: Question[] = [];
  
  // If targeting specific atoms, get those questions
  if (criteria.targetAtomIds && criteria.targetAtomIds.length > 0) {
    for (const atomId of criteria.targetAtomIds) {
      const atomQuestions = getQuestionsByAtom(atomId);
      candidates.push(...atomQuestions);
    }
  } else if (criteria.sectionCode) {
    // Get from difficulty range for section
    candidates = getQuestionsForDifficulty(
      criteria.sectionCode,
      difficultyTarget.min,
      difficultyTarget.max,
      limit
    );
    
    // If not enough, expand search
    if (candidates.length < limit / 2) {
      const additional = getQuestionsBySection(criteria.sectionCode, limit);
      candidates = [...candidates, ...additional];
    }
  } else {
    // Get from all sections
    const sections = ['quant', 'verbal', 'ir'];
    for (const section of sections) {
      const sectionQuestions = getQuestionsForDifficulty(
        section,
        difficultyTarget.min,
        difficultyTarget.max,
        Math.ceil(limit / sections.length)
      );
      candidates.push(...sectionQuestions);
    }
  }
  
  // Remove duplicates
  candidates = [...new Map(candidates.map(q => [q.id, q])).values()];
  
  // Filter by question type if specified
  if (criteria.questionTypeCode) {
    candidates = candidates.filter(q => q.question_type_code === criteria.questionTypeCode);
  }
  
  // Filter out excluded questions
  if (criteria.excludeQuestionIds && criteria.excludeQuestionIds.length > 0) {
    const excludeSet = new Set(criteria.excludeQuestionIds);
    candidates = candidates.filter(q => !excludeSet.has(q.id));
  }
  
  return candidates;
}

/**
 * Get weakness atoms (ones with low mastery)
 */
export function getWeaknessAtomIds(): number[] {
  const learningAtoms = getAtomsByMasteryLevel('learning');
  const reviewingAtoms = getAtomsByMasteryLevel('reviewing');
  
  return [
    ...learningAtoms.map(a => a.atom_id),
    ...reviewingAtoms.map(a => a.atom_id),
  ];
}

// ============================================
// Main Selection Function
// ============================================

/**
 * Select questions based on adaptive criteria
 */
export function selectQuestions(criteria: SelectionCriteria): SelectedQuestion[] {
  const count = criteria.count ?? 1;
  const userElo = getUserElo(criteria.sectionCode);
  const difficultyTarget = calculateDifficultyTarget(userElo, criteria.mode);
  
  // Get candidates
  const candidates = fetchCandidateQuestions(criteria, difficultyTarget, count * 5);
  
  if (candidates.length === 0) {
    return [];
  }
  
  // Enhance criteria with weakness info
  const enhancedCriteria = {
    ...criteria,
    weaknessAtomIds: getWeaknessAtomIds(),
  };
  
  // Score all candidates
  const scoredCandidates = candidates.map(q => 
    scoreQuestion(q, userElo, criteria.mode, enhancedCriteria)
  );
  
  // Sort by score (highest first)
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  // Select with some randomization from top candidates
  const selected: SelectedQuestion[] = [];
  const topPool = scoredCandidates.slice(0, Math.min(count * 3, scoredCandidates.length));
  
  for (let i = 0; i < count && topPool.length > 0; i++) {
    // Weighted random from top 5
    const poolSize = Math.min(5, topPool.length);
    const index = Math.floor(Math.random() * poolSize);
    const chosen = topPool.splice(index, 1)[0];
    
    if (chosen) {
      selected.push({
        question: chosen.question,
        expectedWinRate: chosen.expectedWinRate,
        difficultyMatch: chosen.difficultyMatch,
        selectionReason: chosen.selectionReason,
        explanation: generateExplanation(chosen, criteria.mode, userElo),
      });
    }
  }
  
  return selected;
}

/**
 * Get next single question (convenience function)
 */
export function getNextQuestion(
  mode: SelectionMode = 'build',
  sectionCode?: string,
  excludeQuestionIds: number[] = []
): SelectedQuestion | null {
  // Check review queue first if in review mode
  if (mode === 'review') {
    const dueItems = getDueReviews(5);
    const dueQuestions = dueItems.filter((item: ReviewQueueItem) => item.item_type === 'question');
    
    for (const item of dueQuestions) {
      if (!excludeQuestionIds.includes(item.item_id)) {
        const question = getQuestionById(item.item_id);
        if (question) {
          const userElo = getUserElo(question.section_code);
          return {
            question,
            expectedWinRate: calculateExpectedWinRate(userElo, question.difficulty_rating),
            difficultyMatch: categorizeDifficulty(question.difficulty_rating, userElo),
            selectionReason: 'review_due',
            explanation: 'Due for review based on spaced repetition schedule',
          };
        }
      }
    }
  }
  
  // Use standard selection
  const selected = selectQuestions({
    mode,
    sectionCode,
    excludeQuestionIds,
    count: 1,
  });
  
  return selected[0] ?? null;
}

/**
 * Generate human-readable explanation for selection
 */
function generateExplanation(
  candidate: SelectionCandidate,
  mode: SelectionMode,
  userElo: number
): string {
  const winRatePercent = Math.round(candidate.expectedWinRate * 100);
  
  const modeExplanations = {
    build: 'Building confidence',
    prove: 'Testing mastery',
    review: 'Reinforcing knowledge',
    diagnostic: 'Assessing true level',
  };
  
  const matchExplanations = {
    easy: 'comfortable difficulty to build momentum',
    optimal: 'well-matched to your current level',
    hard: 'a good challenge to push your limits',
    stretch: 'a significant stretch goal',
  };
  
  const reasonExplanations = {
    near_rating: '',
    stretch: ' (selected for growth)',
    weakness: ' (targeting weakness area)',
    random: ' (exploration)',
    review_due: ' (due for review)',
    specific_request: '',
  };
  
  return `${modeExplanations[mode]}: ${matchExplanations[candidate.difficultyMatch]}${reasonExplanations[candidate.selectionReason]} (${winRatePercent}% expected success)`;
}

// ============================================
// Singleton Export
// ============================================

let selectorInstance: QuestionSelector | null = null;

export class QuestionSelector {
  calculateDifficultyTarget = calculateDifficultyTarget;
  categorizeDifficulty = categorizeDifficulty;
  scoreQuestion = scoreQuestion;
  calculateSelectionPlan = calculateSelectionPlan;
  getUserElo = getUserElo;
  fetchCandidateQuestions = fetchCandidateQuestions;
  selectQuestions = selectQuestions;
  getNextQuestion = getNextQuestion;
}

export function getQuestionSelector(): QuestionSelector {
  if (!selectorInstance) {
    selectorInstance = new QuestionSelector();
  }
  return selectorInstance;
}
