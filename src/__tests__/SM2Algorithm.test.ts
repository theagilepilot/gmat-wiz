/**
 * Spaced Repetition (SM-2) Algorithm Tests
 * Tests the core SM-2 calculation logic
 */

// SM-2 Algorithm pure functions extracted for testing
// These mirror the logic in processReview() from Scheduling.ts

interface SM2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
}

function calculateSM2(
  current: SM2State,
  quality: number // 0-5: 0-2 = fail, 3 = hard, 4 = good, 5 = easy
): SM2State {
  let { easeFactor, interval, repetitions } = current;

  if (quality < 3) {
    // Failed - reset
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  // Update ease factor
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  return { easeFactor, interval, repetitions };
}

describe('SM-2 Spaced Repetition Algorithm', () => {
  const defaultState: SM2State = {
    easeFactor: 2.5, // Default SM-2 ease factor
    interval: 0,
    repetitions: 0,
  };

  describe('First review', () => {
    test('perfect recall (quality=5) sets interval to 1 day', () => {
      const result = calculateSM2(defaultState, 5);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    test('good recall (quality=4) sets interval to 1 day', () => {
      const result = calculateSM2(defaultState, 4);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    test('hard recall (quality=3) sets interval to 1 day', () => {
      const result = calculateSM2(defaultState, 3);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    test('failed recall (quality<3) resets to interval 1', () => {
      const result = calculateSM2(defaultState, 2);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });
  });

  describe('Second review', () => {
    test('successful second review sets interval to 6 days', () => {
      const afterFirst: SM2State = {
        easeFactor: 2.5,
        interval: 1,
        repetitions: 1,
      };
      const result = calculateSM2(afterFirst, 4);
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });
  });

  describe('Subsequent reviews', () => {
    test('interval grows by ease factor on success', () => {
      const afterSecond: SM2State = {
        easeFactor: 2.5,
        interval: 6,
        repetitions: 2,
      };
      const result = calculateSM2(afterSecond, 4);
      // 6 * 2.5 = 15
      expect(result.interval).toBe(15);
      expect(result.repetitions).toBe(3);
    });

    test('failure at any point resets progress', () => {
      const wellPracticed: SM2State = {
        easeFactor: 2.6,
        interval: 30,
        repetitions: 5,
      };
      const result = calculateSM2(wellPracticed, 1);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });
  });

  describe('Ease factor adjustments', () => {
    test('perfect recall (quality=5) increases ease factor', () => {
      const result = calculateSM2(defaultState, 5);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });

    test('good recall (quality=4) maintains ease factor roughly', () => {
      const result = calculateSM2(defaultState, 4);
      expect(result.easeFactor).toBeCloseTo(2.5, 1);
    });

    test('hard recall (quality=3) decreases ease factor', () => {
      const result = calculateSM2(defaultState, 3);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    test('ease factor never goes below 1.3', () => {
      // Simulate many hard reviews
      let state = defaultState;
      for (let i = 0; i < 20; i++) {
        state = calculateSM2(state, 3);
      }
      expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe('Long-term progression', () => {
    test('consistent good reviews lead to exponential interval growth', () => {
      let state = defaultState;
      const intervals: number[] = [];

      // Simulate 6 successful reviews
      for (let i = 0; i < 6; i++) {
        state = calculateSM2(state, 4);
        intervals.push(state.interval);
      }

      // First: 1, Second: 6, then growing
      expect(intervals[0]).toBe(1);
      expect(intervals[1]).toBe(6);
      
      // Each subsequent interval should be larger
      for (let i = 2; i < intervals.length; i++) {
        expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!);
      }
    });
  });
});
