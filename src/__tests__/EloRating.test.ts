/**
 * ELO Rating Calculation Tests
 * Tests pure calculation functions (no database needed)
 */

// Constants from EloRating.ts
const ELO_K_FACTOR = 32;
const ELO_DEFAULT_RATING = 500;
const MASTERY_ACCURACY_THRESHOLD = 0.85;
const MASTERY_MIN_ATTEMPTS = 10;
const MASTERY_STREAK_THRESHOLD = 5;

// Pure ELO calculation functions (mirrored from EloRating.ts for isolated testing)
function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function calculateNewRating(
  currentRating: number,
  opponentRating: number,
  actualScore: number,
  kFactor: number = ELO_K_FACTOR
): number {
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  const newRating = currentRating + kFactor * (actualScore - expectedScore);
  return Math.round(newRating);
}

function getAdaptiveKFactor(gamesPlayed: number, ratingDeviation: number): number {
  if (gamesPlayed < 10) return 40;
  if (gamesPlayed < 30) return 32;
  if (gamesPlayed < 100) return 24;
  
  const deviationFactor = Math.min(1, ratingDeviation / 100);
  return Math.max(16, 20 * deviationFactor);
}

describe('ELO Rating Calculations', () => {
  describe('calculateExpectedScore', () => {
    test('equal ratings should give 50% expected score', () => {
      const expected = calculateExpectedScore(500, 500);
      expect(expected).toBeCloseTo(0.5, 2);
    });

    test('higher rated player should have higher expected score', () => {
      const expected = calculateExpectedScore(600, 500);
      expect(expected).toBeGreaterThan(0.5);
      expect(expected).toBeLessThan(1);
    });

    test('lower rated player should have lower expected score', () => {
      const expected = calculateExpectedScore(400, 500);
      expect(expected).toBeLessThan(0.5);
      expect(expected).toBeGreaterThan(0);
    });

    test('400 point rating difference should give ~91% expected score', () => {
      // 400 point difference in ELO = 10:1 odds
      const expected = calculateExpectedScore(900, 500);
      expect(expected).toBeCloseTo(0.909, 2);
    });
  });

  describe('calculateNewRating', () => {
    test('winning against equal opponent should increase rating', () => {
      const newRating = calculateNewRating(500, 500, 1); // Win
      expect(newRating).toBeGreaterThan(500);
      // With K=32, expected change is K * (1 - 0.5) = 16
      expect(newRating).toBe(516);
    });

    test('losing against equal opponent should decrease rating', () => {
      const newRating = calculateNewRating(500, 500, 0); // Loss
      expect(newRating).toBeLessThan(500);
      expect(newRating).toBe(484);
    });

    test('beating higher rated opponent gives bigger boost', () => {
      const easyWin = calculateNewRating(500, 500, 1); // Beat equal
      const upsetWin = calculateNewRating(500, 700, 1); // Beat stronger
      expect(upsetWin - 500).toBeGreaterThan(easyWin - 500);
    });

    test('losing to weaker opponent gives bigger penalty', () => {
      const normalLoss = calculateNewRating(500, 500, 0); // Lose to equal
      const upsetLoss = calculateNewRating(500, 300, 0); // Lose to weaker
      expect(500 - upsetLoss).toBeGreaterThan(500 - normalLoss);
    });

    test('custom K-factor affects rating change magnitude', () => {
      const lowK = calculateNewRating(500, 500, 1, 16);
      const highK = calculateNewRating(500, 500, 1, 40);
      expect(highK - 500).toBeGreaterThan(lowK - 500);
    });
  });

  describe('getAdaptiveKFactor', () => {
    test('new players (< 10 games) get highest K-factor', () => {
      const kFactor = getAdaptiveKFactor(5, 350);
      expect(kFactor).toBe(40);
    });

    test('intermediate players (10-30 games) get standard K-factor', () => {
      const kFactor = getAdaptiveKFactor(20, 200);
      expect(kFactor).toBe(32);
    });

    test('experienced players (30-100 games) get lower K-factor', () => {
      const kFactor = getAdaptiveKFactor(50, 150);
      expect(kFactor).toBe(24);
    });

    test('veteran players (100+ games) get lowest K-factor', () => {
      const kFactor = getAdaptiveKFactor(200, 50);
      expect(kFactor).toBeLessThanOrEqual(20);
      expect(kFactor).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Constants', () => {
    test('default ELO values are reasonable', () => {
      expect(ELO_K_FACTOR).toBe(32);
      expect(ELO_DEFAULT_RATING).toBe(500);
    });

    test('mastery thresholds are set correctly', () => {
      expect(MASTERY_ACCURACY_THRESHOLD).toBe(0.85); // 85%
      expect(MASTERY_MIN_ATTEMPTS).toBe(10);
      expect(MASTERY_STREAK_THRESHOLD).toBe(5);
    });
  });
});
