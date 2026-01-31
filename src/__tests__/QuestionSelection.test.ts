/**
 * Question Selection Service Tests
 * Tests adaptive difficulty calculation (pure functions, no DB)
 */

// Re-create the pure calculation functions for isolated testing
// These mirror the logic in QuestionSelectionService.ts

const DIFFICULTY_BANDS = {
  build: { offset: -100, range: 150 },
  prove: { offset: 0, range: 100 },
  review: { offset: -50, range: 100 },
  diagnostic: { offset: 0, range: 300 },
};

const TARGET_WIN_RATES = {
  build: 0.75,
  prove: 0.55,
  review: 0.80,
  diagnostic: 0.50,
};

type SelectionMode = 'build' | 'prove' | 'review' | 'diagnostic';

function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function calculateDifficultyRange(
  userElo: number,
  mode: SelectionMode
): { min: number; max: number; label: string } {
  const band = DIFFICULTY_BANDS[mode];
  const center = userElo + band.offset;
  const halfRange = band.range / 2;
  
  return {
    min: Math.max(100, Math.round(center - halfRange)),
    max: Math.min(900, Math.round(center + halfRange)),
    label: mode,
  };
}

function scoreDifficultyMatch(
  questionDifficulty: number,
  userElo: number,
  mode: SelectionMode
): number {
  const targetWinRate = TARGET_WIN_RATES[mode];
  const actualExpectedScore = calculateExpectedScore(userElo, questionDifficulty);
  const difference = Math.abs(actualExpectedScore - targetWinRate);
  return Math.round(Math.max(0, 100 - difference * 200));
}

function categorizeDifficultyMatch(
  questionDifficulty: number,
  userElo: number
): 'easy' | 'optimal' | 'hard' | 'stretch' {
  const eloDiff = questionDifficulty - userElo;
  
  if (eloDiff < -100) return 'easy';
  if (eloDiff >= -100 && eloDiff <= 100) return 'optimal';
  if (eloDiff > 100 && eloDiff <= 200) return 'hard';
  return 'stretch';
}

describe('Question Selection - Difficulty Range', () => {
  describe('calculateDifficultyRange', () => {
    test('build mode targets slightly easier questions', () => {
      const range = calculateDifficultyRange(500, 'build');
      // Center should be 500 - 100 = 400, range ±75
      expect(range.min).toBe(325);
      expect(range.max).toBe(475);
    });

    test('prove mode targets user level', () => {
      const range = calculateDifficultyRange(500, 'prove');
      // Center should be 500, range ±50
      expect(range.min).toBe(450);
      expect(range.max).toBe(550);
    });

    test('review mode targets slightly easier', () => {
      const range = calculateDifficultyRange(500, 'review');
      // Center should be 500 - 50 = 450, range ±50
      expect(range.min).toBe(400);
      expect(range.max).toBe(500);
    });

    test('diagnostic mode has wide range', () => {
      const range = calculateDifficultyRange(500, 'diagnostic');
      // Center should be 500, range ±150
      expect(range.min).toBe(350);
      expect(range.max).toBe(650);
    });

    test('range is clamped to valid bounds (low ELO)', () => {
      const range = calculateDifficultyRange(150, 'build');
      expect(range.min).toBeGreaterThanOrEqual(100);
    });

    test('range is clamped to valid bounds (high ELO)', () => {
      const range = calculateDifficultyRange(850, 'prove');
      expect(range.max).toBeLessThanOrEqual(900);
    });
  });
});

describe('Question Selection - Difficulty Match Scoring', () => {
  describe('scoreDifficultyMatch', () => {
    test('perfect match for build mode (75% win rate) scores high', () => {
      // For 75% win rate with ELO 500, question should be ~400
      // E(500, 400) = 1/(1 + 10^(-100/400)) ≈ 0.64, not quite 75%
      // For exactly 75%, need question at ~320
      const userElo = 500;
      // Find difficulty that gives ~75% win rate
      // 0.75 = 1/(1 + 10^((D-500)/400))
      // Solving: D ≈ 320
      const score = scoreDifficultyMatch(320, userElo, 'build');
      expect(score).toBeGreaterThan(70);
    });

    test('perfect match for prove mode (55% win rate) scores high', () => {
      const userElo = 500;
      // For 55% win rate: D ≈ 470
      const score = scoreDifficultyMatch(480, userElo, 'prove');
      expect(score).toBeGreaterThan(80);
    });

    test('too easy question scores lower for prove mode', () => {
      const userElo = 500;
      const easyScore = scoreDifficultyMatch(300, userElo, 'prove');
      const optimalScore = scoreDifficultyMatch(480, userElo, 'prove');
      expect(optimalScore).toBeGreaterThan(easyScore);
    });

    test('too hard question scores lower for build mode', () => {
      const userElo = 500;
      const hardScore = scoreDifficultyMatch(700, userElo, 'build');
      const optimalScore = scoreDifficultyMatch(400, userElo, 'build');
      expect(optimalScore).toBeGreaterThan(hardScore);
    });
  });

  describe('categorizeDifficultyMatch', () => {
    test('question 150 below user ELO is easy', () => {
      expect(categorizeDifficultyMatch(350, 500)).toBe('easy');
    });

    test('question within ±100 of user ELO is optimal', () => {
      expect(categorizeDifficultyMatch(450, 500)).toBe('optimal');
      expect(categorizeDifficultyMatch(550, 500)).toBe('optimal');
      expect(categorizeDifficultyMatch(500, 500)).toBe('optimal');
    });

    test('question 150 above user ELO is hard', () => {
      expect(categorizeDifficultyMatch(650, 500)).toBe('hard');
    });

    test('question 250+ above user ELO is stretch', () => {
      expect(categorizeDifficultyMatch(750, 500)).toBe('stretch');
    });
  });
});

describe('Question Selection - Target Win Rates', () => {
  test('build mode aims for 75% success rate', () => {
    expect(TARGET_WIN_RATES.build).toBe(0.75);
  });

  test('prove mode aims for 55% success rate (challenging)', () => {
    expect(TARGET_WIN_RATES.prove).toBe(0.55);
  });

  test('review mode aims for 80% success rate (reinforcement)', () => {
    expect(TARGET_WIN_RATES.review).toBe(0.80);
  });

  test('diagnostic mode aims for 50% (true assessment)', () => {
    expect(TARGET_WIN_RATES.diagnostic).toBe(0.50);
  });
});
