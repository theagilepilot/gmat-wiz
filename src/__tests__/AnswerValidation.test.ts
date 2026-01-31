/**
 * Answer Validation Service Tests
 * Tests outcome determination, timing analysis, XP calculation, and feedback
 */

// Pure functions extracted for isolated testing (mirrors AnswerValidationService.ts)

type OutcomeType = 
  | 'clean_win'
  | 'slow_win'
  | 'lucky_win'
  | 'expected_loss'
  | 'upset_loss'
  | 'timeout';

interface TimingAnalysis {
  timeTaken: number;
  timeAllowed: number;
  timeRatio: number;
  wasOvertime: boolean;
  timingCategory: 'fast' | 'optimal' | 'slow' | 'overtime';
}

interface AttemptFeedback {
  headline: string;
  message: string;
  suggestions: string[];
  requiresReflection: boolean;
  reflectionPrompt?: string;
}

type DifficultyCategory = 'easy' | 'moderate' | 'hard' | 'stretch';

const XP_BASE = 10;
const XP_FAST_BONUS = 5;
const XP_CLEAN_BONUS = 5;
const XP_UPSET_BONUS = 10;
const XP_GUESS_PENALTY = 5;

function determineOutcomeType(
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

function analyzeTimingPerformance(
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

function categorizeDifficulty(expectedWinRate: number): DifficultyCategory {
  if (expectedWinRate >= 0.75) return 'easy';
  if (expectedWinRate >= 0.55) return 'moderate';
  if (expectedWinRate >= 0.35) return 'hard';
  return 'stretch';
}

function calculateXPEarned(
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

function generateFeedback(
  outcomeType: OutcomeType,
  timingAnalysis: TimingAnalysis,
  difficultyCategory: DifficultyCategory
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

describe('Answer Validation - Outcome Determination', () => {
  describe('determineOutcomeType', () => {
    test('correct + fast + no guess = clean_win', () => {
      const outcome = determineOutcomeType(true, false, false, 0.5);
      expect(outcome).toBe('clean_win');
    });

    test('correct + overtime = slow_win', () => {
      const outcome = determineOutcomeType(true, true, false, 0.5);
      expect(outcome).toBe('slow_win');
    });

    test('correct + guessed = lucky_win', () => {
      const outcome = determineOutcomeType(true, false, true, 0.5);
      expect(outcome).toBe('lucky_win');
    });

    test('incorrect + overtime = timeout', () => {
      const outcome = determineOutcomeType(false, true, false, 0.5);
      expect(outcome).toBe('timeout');
    });

    test('incorrect on easy question (high expected win) = upset_loss', () => {
      const outcome = determineOutcomeType(false, false, false, 0.75);
      expect(outcome).toBe('upset_loss');
    });

    test('incorrect on hard question (low expected win) = expected_loss', () => {
      const outcome = determineOutcomeType(false, false, false, 0.3);
      expect(outcome).toBe('expected_loss');
    });
  });
});

describe('Answer Validation - Timing Analysis', () => {
  describe('analyzeTimingPerformance', () => {
    test('under 60% of time is fast', () => {
      const result = analyzeTimingPerformance(50, 100);
      expect(result.timingCategory).toBe('fast');
      expect(result.wasOvertime).toBe(false);
    });

    test('60-100% of time is optimal', () => {
      const result = analyzeTimingPerformance(80, 100);
      expect(result.timingCategory).toBe('optimal');
    });

    test('100-150% of time is slow', () => {
      const result = analyzeTimingPerformance(120, 100);
      expect(result.timingCategory).toBe('slow');
      expect(result.wasOvertime).toBe(true);
    });

    test('over 150% of time is overtime', () => {
      const result = analyzeTimingPerformance(200, 100);
      expect(result.timingCategory).toBe('overtime');
    });

    test('time ratio is calculated correctly', () => {
      const result = analyzeTimingPerformance(75, 100);
      expect(result.timeRatio).toBe(0.75);
    });
  });
});

describe('Answer Validation - Difficulty Categorization', () => {
  describe('categorizeDifficulty', () => {
    test('75%+ win rate = easy', () => {
      expect(categorizeDifficulty(0.80)).toBe('easy');
    });

    test('55-74% win rate = moderate', () => {
      expect(categorizeDifficulty(0.60)).toBe('moderate');
    });

    test('35-54% win rate = hard', () => {
      expect(categorizeDifficulty(0.45)).toBe('hard');
    });

    test('under 35% win rate = stretch', () => {
      expect(categorizeDifficulty(0.25)).toBe('stretch');
    });
  });
});

describe('Answer Validation - XP Calculation', () => {
  describe('calculateXPEarned', () => {
    test('incorrect answer gives 0 XP', () => {
      const xp = calculateXPEarned(false, 'expected_loss', false, false);
      expect(xp).toBe(0);
    });

    test('clean win gives base + bonuses (20 XP)', () => {
      const xp = calculateXPEarned(true, 'clean_win', false, false);
      expect(xp).toBe(20); // 10 base + 5 fast + 5 clean
    });

    test('slow win gives only base XP (10 XP)', () => {
      const xp = calculateXPEarned(true, 'slow_win', false, false);
      expect(xp).toBe(10);
    });

    test('lucky win (guessed) has penalty (5 XP)', () => {
      const xp = calculateXPEarned(true, 'lucky_win', false, true);
      expect(xp).toBe(5); // 10 - 5 guess penalty
    });

    test('upset win adds bonus XP', () => {
      const normalWin = calculateXPEarned(true, 'clean_win', false, false);
      const upsetWin = calculateXPEarned(true, 'clean_win', true, false);
      expect(upsetWin).toBe(normalWin + 10); // +10 upset bonus
    });
  });
});

describe('Answer Validation - Feedback Generation', () => {
  describe('generateFeedback', () => {
    const defaultTiming = {
      timeTaken: 60,
      timeAllowed: 100,
      timeRatio: 0.6,
      wasOvertime: false,
      timingCategory: 'fast' as const,
    };

    test('clean_win generates positive feedback', () => {
      const feedback = generateFeedback('clean_win', defaultTiming, 'moderate');
      expect(feedback.headline).toContain('Clean Win');
      expect(feedback.requiresReflection).toBe(false);
    });

    test('upset_loss requires reflection', () => {
      const feedback = generateFeedback('upset_loss', defaultTiming, 'easy');
      expect(feedback.requiresReflection).toBe(true);
      expect(feedback.reflectionPrompt).toBeDefined();
    });

    test('timeout provides time management suggestions', () => {
      const overtimeTiming = { ...defaultTiming, wasOvertime: true, timingCategory: 'overtime' as const };
      const feedback = generateFeedback('timeout', overtimeTiming, 'moderate');
      expect(feedback.suggestions.length).toBeGreaterThan(0);
      expect(feedback.suggestions.some(s => s.toLowerCase().includes('time'))).toBe(true);
    });

    test('lucky_win suggests reviewing explanation', () => {
      const feedback = generateFeedback('lucky_win', defaultTiming, 'moderate');
      expect(feedback.suggestions.some(s => s.toLowerCase().includes('review'))).toBe(true);
    });
  });
});
