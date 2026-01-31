/**
 * Answer Validation Service
 * Validates answers and generates feedback for attempts
 */

import { Attempt, getAttemptById } from '../models/Question.js';
import { calculateExpectedScore } from '../models/EloRating.js';

// ============================================
// Types
// ============================================

export type OutcomeType = 
  | 'clean_win'      // Correct, under time, no hints
  | 'slow_win'       // Correct, but over time
  | 'lucky_win'      // Correct, was guessed
  | 'expected_loss'  // Incorrect, question was hard
  | 'upset_loss'     // Incorrect, question should have been easy
  | 'timeout';       // Ran out of time

export interface ValidationResult {
  isCorrect: boolean;
  outcomeType: OutcomeType;
  timingAnalysis: TimingAnalysis;
  performanceAnalysis: PerformanceAnalysis;
  feedback: AttemptFeedback;
}

export interface TimingAnalysis {
  timeTaken: number;
  timeAllowed: number;
  timeRatio: number;
  wasOvertime: boolean;
  timingCategory: 'fast' | 'optimal' | 'slow' | 'overtime';
}

export interface PerformanceAnalysis {
  expectedWinRate: number;
  wasUpset: boolean;
  difficultyCategory: 'easy' | 'moderate' | 'hard' | 'stretch';
  xpEarned: number;
}

export interface AttemptFeedback {
  headline: string;
  message: string;
  suggestions: string[];
  requiresReflection: boolean;
  reflectionPrompt?: string;
}

// ============================================
// XP Calculation Constants
// ============================================

const XP_BASE = 10;
const XP_FAST_BONUS = 5;
const XP_CLEAN_BONUS = 5;
const XP_UPSET_BONUS = 10;
const XP_GUESS_PENALTY = 5;

// ============================================
// Pure Calculation Functions (for testing)
// ============================================

/**
 * Determine the outcome type based on attempt details
 */
export function determineOutcomeType(
  isCorrect: boolean,
  wasOvertime: boolean,
  wasGuessed: boolean,
  expectedWinRate: number
): OutcomeType {
  if (!isCorrect) {
    if (wasOvertime) return 'timeout';
    return expectedWinRate > 0.6 ? 'upset_loss' : 'expected_loss';
  }
  
  if (wasGuessed) return 'lucky_win';
  if (wasOvertime) return 'slow_win';
  return 'clean_win';
}

/**
 * Analyze timing performance
 */
export function analyzeTimingPerformance(
  timeTaken: number,
  timeAllowed: number
): TimingAnalysis {
  const timeRatio = timeTaken / timeAllowed;
  const wasOvertime = timeTaken > timeAllowed;
  
  let timingCategory: TimingAnalysis['timingCategory'];
  if (timeRatio <= 0.6) {
    timingCategory = 'fast';
  } else if (timeRatio <= 1.0) {
    timingCategory = 'optimal';
  } else if (timeRatio <= 1.5) {
    timingCategory = 'slow';
  } else {
    timingCategory = 'overtime';
  }
  
  return {
    timeTaken,
    timeAllowed,
    timeRatio: Math.round(timeRatio * 100) / 100,
    wasOvertime,
    timingCategory,
  };
}

/**
 * Categorize difficulty based on expected win rate
 */
export function categorizeDifficulty(expectedWinRate: number): PerformanceAnalysis['difficultyCategory'] {
  if (expectedWinRate >= 0.75) return 'easy';
  if (expectedWinRate >= 0.55) return 'moderate';
  if (expectedWinRate >= 0.35) return 'hard';
  return 'stretch';
}

/**
 * Calculate XP earned for an attempt
 */
export function calculateXPEarned(
  isCorrect: boolean,
  outcomeType: OutcomeType,
  wasUpset: boolean,
  wasGuessed: boolean
): number {
  if (!isCorrect) return 0;
  
  let xp = XP_BASE;
  
  if (outcomeType === 'clean_win') {
    xp += XP_FAST_BONUS + XP_CLEAN_BONUS;
  } else if (outcomeType === 'slow_win') {
    // No bonus for slow win
  } else if (outcomeType === 'lucky_win') {
    xp -= XP_GUESS_PENALTY;
  }
  
  if (wasUpset) {
    xp += XP_UPSET_BONUS;
  }
  
  return Math.max(0, xp);
}

/**
 * Generate feedback based on outcome
 */
export function generateFeedback(
  outcomeType: OutcomeType,
  timingAnalysis: TimingAnalysis,
  difficultyCategory: PerformanceAnalysis['difficultyCategory']
): AttemptFeedback {
  const feedback: AttemptFeedback = {
    headline: '',
    message: '',
    suggestions: [],
    requiresReflection: false,
  };
  
  switch (outcomeType) {
    case 'clean_win':
      feedback.headline = '🎯 Clean Win!';
      feedback.message = 'Great job! You got it right within the time budget.';
      if (difficultyCategory === 'hard' || difficultyCategory === 'stretch') {
        feedback.headline = '🔥 Excellent!';
        feedback.message = 'You nailed a challenging question!';
      }
      break;
      
    case 'slow_win':
      feedback.headline = '✓ Correct, but slow';
      feedback.message = `You got it right but took ${Math.round(timingAnalysis.timeRatio * 100)}% of the allowed time.`;
      feedback.suggestions.push('Practice similar questions to improve speed');
      feedback.suggestions.push('Look for faster solution methods');
      break;
      
    case 'lucky_win':
      feedback.headline = '🍀 Lucky Guess';
      feedback.message = 'You got it right, but guessing won\'t work on test day.';
      feedback.suggestions.push('Review the explanation to understand the concept');
      feedback.requiresReflection = true;
      feedback.reflectionPrompt = 'What made you unsure about this question?';
      break;
      
    case 'expected_loss':
      feedback.headline = '✗ Incorrect';
      feedback.message = 'This was a challenging question. Let\'s learn from it.';
      feedback.suggestions.push('Review the explanation carefully');
      feedback.suggestions.push('Identify the concept gap');
      feedback.requiresReflection = true;
      feedback.reflectionPrompt = 'What concept or pattern did you miss?';
      break;
      
    case 'upset_loss':
      feedback.headline = '⚠️ Careless Error?';
      feedback.message = 'You should have gotten this one. What happened?';
      feedback.suggestions.push('Check your work process');
      feedback.suggestions.push('Watch for trap answers');
      feedback.requiresReflection = true;
      feedback.reflectionPrompt = 'Was this a careless error, misread, or concept gap?';
      break;
      
    case 'timeout':
      feedback.headline = '⏱️ Time Out';
      feedback.message = 'You ran out of time on this question.';
      feedback.suggestions.push('Practice time management');
      feedback.suggestions.push('Know when to guess and move on');
      feedback.requiresReflection = true;
      feedback.reflectionPrompt = 'Where did you get stuck or spend too much time?';
      break;
  }
  
  return feedback;
}

// ============================================
// Service Functions
// ============================================

/**
 * Fully validate an attempt and generate comprehensive feedback
 */
export function validateAttempt(
  userAnswer: string,
  correctAnswer: string,
  timeTaken: number,
  timeAllowed: number,
  userElo: number,
  questionDifficulty: number,
  wasGuessed: boolean = false
): ValidationResult {
  const isCorrect = userAnswer.toUpperCase().trim() === correctAnswer.toUpperCase().trim();
  const expectedWinRate = calculateExpectedScore(userElo, questionDifficulty);
  const wasUpset = isCorrect 
    ? expectedWinRate < 0.4  // Win when expected to lose
    : expectedWinRate > 0.6; // Loss when expected to win
  
  const timingAnalysis = analyzeTimingPerformance(timeTaken, timeAllowed);
  const outcomeType = determineOutcomeType(isCorrect, timingAnalysis.wasOvertime, wasGuessed, expectedWinRate);
  const difficultyCategory = categorizeDifficulty(expectedWinRate);
  const xpEarned = calculateXPEarned(isCorrect, outcomeType, wasUpset, wasGuessed);
  const feedback = generateFeedback(outcomeType, timingAnalysis, difficultyCategory);
  
  return {
    isCorrect,
    outcomeType,
    timingAnalysis,
    performanceAnalysis: {
      expectedWinRate: Math.round(expectedWinRate * 100),
      wasUpset,
      difficultyCategory,
      xpEarned,
    },
    feedback,
  };
}

/**
 * Generate reflection prompts based on error type
 */
export function getReflectionPrompts(outcomeType: OutcomeType): string[] {
  const prompts: Record<OutcomeType, string[]> = {
    clean_win: [],
    slow_win: [
      'What step took the longest?',
      'Is there a faster method you could have used?',
    ],
    lucky_win: [
      'What made you unsure?',
      'What concept do you need to review?',
    ],
    expected_loss: [
      'What concept did you not understand?',
      'What pattern should you recognize next time?',
      'What prerequisite knowledge were you missing?',
    ],
    upset_loss: [
      'Did you misread the question?',
      'Did you fall for a trap answer?',
      'Was this a calculation error?',
      'Did you skip a step in your process?',
    ],
    timeout: [
      'Where did you get stuck?',
      'Should you have guessed earlier?',
      'What strategy would help you move faster?',
    ],
  };
  
  return prompts[outcomeType] ?? [];
}
