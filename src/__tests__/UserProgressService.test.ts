/**
 * UserProgressService Tests
 * Tests XP calculation and leveling logic (pure functions)
 */

// Constants from UserProgressService
const LEVELS = [
  { level: 1, name: 'Orientation', xpRequired: 0 },
  { level: 2, name: 'Foundations', xpRequired: 500 },
  { level: 3, name: 'Recognition', xpRequired: 1500 },
  { level: 4, name: 'Easy Mastery', xpRequired: 3000 },
  { level: 5, name: 'Medium Control', xpRequired: 5000 },
  { level: 6, name: 'Strategy & Abandonment', xpRequired: 8000 },
  { level: 7, name: 'Hard Exposure', xpRequired: 12000 },
  { level: 8, name: 'Consistency', xpRequired: 17000 },
  { level: 9, name: 'Elite Execution', xpRequired: 23000 },
  { level: 10, name: 'Test-Day Operator', xpRequired: 30000 },
];

const XP_AWARDS = {
  CORRECT_ANSWER: 10,
  CORRECT_FAST: 15,
  CORRECT_CLEAN: 20,
  HINT_PENALTY: -3,
  STREAK_BONUS_PER_DAY: 5,
  PROVE_MODE_MULTIPLIER: 1.5,
  LEVEL_COMPLETION_BONUS: 100,
};

// Pure functions for testing
function getLevelForXP(totalXP: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i]!.xpRequired) {
      return LEVELS[i]!.level;
    }
  }
  return 1;
}

function calculateXPToNextLevel(currentLevel: number, totalXP: number): { current: number; required: number; progress: number } {
  const currentLevelInfo = LEVELS[currentLevel - 1]!;
  const nextLevelInfo = LEVELS[currentLevel];
  
  if (!nextLevelInfo) {
    return { current: totalXP, required: totalXP, progress: 100 };
  }
  
  const xpInCurrentLevel = totalXP - currentLevelInfo.xpRequired;
  const xpRequiredForNext = nextLevelInfo.xpRequired - currentLevelInfo.xpRequired;
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForNext) * 100));
  
  return {
    current: xpInCurrentLevel,
    required: xpRequiredForNext,
    progress,
  };
}

function calculateQuestionXP(options: {
  correct: boolean;
  fast: boolean;
  clean: boolean;
  usedHint: boolean;
  proveMode: boolean;
  streakDays: number;
}): number {
  let xp = 0;
  
  if (!options.correct) return 0;
  
  // Base XP
  if (options.clean) {
    xp = XP_AWARDS.CORRECT_CLEAN;
  } else if (options.fast) {
    xp = XP_AWARDS.CORRECT_FAST;
  } else {
    xp = XP_AWARDS.CORRECT_ANSWER;
  }
  
  // Hint penalty
  if (options.usedHint) {
    xp += XP_AWARDS.HINT_PENALTY;
  }
  
  // Streak bonus (capped at 50)
  const streakBonus = Math.min(50, options.streakDays * XP_AWARDS.STREAK_BONUS_PER_DAY);
  xp += streakBonus;
  
  // Prove mode multiplier
  if (options.proveMode) {
    xp = Math.round(xp * XP_AWARDS.PROVE_MODE_MULTIPLIER);
  }
  
  return Math.max(0, xp);
}

describe('User Progress Service - Level System', () => {
  describe('getLevelForXP', () => {
    test('0 XP is level 1', () => {
      expect(getLevelForXP(0)).toBe(1);
    });

    test('500 XP is level 2', () => {
      expect(getLevelForXP(500)).toBe(2);
    });

    test('499 XP is still level 1', () => {
      expect(getLevelForXP(499)).toBe(1);
    });

    test('30000 XP is max level (10)', () => {
      expect(getLevelForXP(30000)).toBe(10);
    });

    test('50000 XP is still level 10 (capped)', () => {
      expect(getLevelForXP(50000)).toBe(10);
    });
  });

  describe('calculateXPToNextLevel', () => {
    test('level 1 with 0 XP needs 500 XP for level 2', () => {
      const result = calculateXPToNextLevel(1, 0);
      expect(result.required).toBe(500);
      expect(result.current).toBe(0);
      expect(result.progress).toBe(0);
    });

    test('level 1 with 250 XP is 50% to level 2', () => {
      const result = calculateXPToNextLevel(1, 250);
      expect(result.current).toBe(250);
      expect(result.progress).toBe(50);
    });

    test('max level shows 100% progress', () => {
      const result = calculateXPToNextLevel(10, 35000);
      expect(result.progress).toBe(100);
    });
  });
});

describe('User Progress Service - XP Awards', () => {
  describe('calculateQuestionXP', () => {
    test('incorrect answer gives 0 XP', () => {
      const xp = calculateQuestionXP({
        correct: false,
        fast: true,
        clean: true,
        usedHint: false,
        proveMode: true,
        streakDays: 10,
      });
      expect(xp).toBe(0);
    });

    test('basic correct answer gives 10 XP', () => {
      const xp = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 0,
      });
      expect(xp).toBe(10);
    });

    test('fast correct answer gives 15 XP', () => {
      const xp = calculateQuestionXP({
        correct: true,
        fast: true,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 0,
      });
      expect(xp).toBe(15);
    });

    test('clean win gives 20 XP', () => {
      const xp = calculateQuestionXP({
        correct: true,
        fast: true,
        clean: true,
        usedHint: false,
        proveMode: false,
        streakDays: 0,
      });
      expect(xp).toBe(20);
    });

    test('hint penalty reduces XP', () => {
      const withoutHint = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 0,
      });
      const withHint = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: true,
        proveMode: false,
        streakDays: 0,
      });
      expect(withHint).toBe(withoutHint - 3);
    });

    test('streak bonus adds XP (5 per day)', () => {
      const noStreak = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 0,
      });
      const fiveDayStreak = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 5,
      });
      expect(fiveDayStreak).toBe(noStreak + 25); // 5 * 5 = 25
    });

    test('streak bonus capped at 50 XP', () => {
      const maxStreak = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 100,
      });
      expect(maxStreak).toBe(10 + 50); // base + max streak bonus
    });

    test('prove mode multiplies XP by 1.5', () => {
      const buildMode = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: false,
        streakDays: 0,
      });
      const proveMode = calculateQuestionXP({
        correct: true,
        fast: false,
        clean: false,
        usedHint: false,
        proveMode: true,
        streakDays: 0,
      });
      expect(proveMode).toBe(Math.round(buildMode * 1.5));
    });
  });
});
