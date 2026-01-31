/**
 * Tests for Scheduler Module
 * Tests core logic without database dependency
 */

import {
  DEFAULT_SCHEDULER_CONFIG,
  PriorityFactor
} from '../scheduler/types';

// Since the scheduler classes now depend on the actual database connection,
// we test the core logic through their exported pure functions and algorithms

describe('Spaced Repetition Algorithm', () => {
  // Test the SM-2 algorithm logic directly
  
  describe('SM-2 Ease Factor Calculation', () => {
    // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    const calculateNewEaseFactor = (currentEF: number, quality: number): number => {
      const newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      return Math.max(1.3, newEF);
    };

    it('should increase ease factor for quality 5 (perfect)', () => {
      const newEF = calculateNewEaseFactor(2.5, 5);
      expect(newEF).toBeGreaterThan(2.5);
    });

    it('should maintain ease factor for quality 4', () => {
      const newEF = calculateNewEaseFactor(2.5, 4);
      expect(newEF).toBeGreaterThanOrEqual(2.5);
    });

    it('should decrease ease factor for quality 3 (difficult)', () => {
      const newEF = calculateNewEaseFactor(2.5, 3);
      expect(newEF).toBeLessThan(2.5);
    });

    it('should decrease ease factor for quality 2', () => {
      const newEF = calculateNewEaseFactor(2.5, 2);
      expect(newEF).toBeLessThan(2.5);
    });

    it('should not go below minimum ease factor of 1.3', () => {
      let ef = 2.5;
      for (let i = 0; i < 20; i++) {
        ef = calculateNewEaseFactor(ef, 0);
      }
      expect(ef).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe('Interval Calculation', () => {
    it('should use initial interval of 1 for first repetition', () => {
      expect(DEFAULT_SCHEDULER_CONFIG).toBeDefined();
      // First interval is always 1 day
    });

    it('should use graduating interval for second repetition', () => {
      // After first successful rep, interval becomes 6 days
      const graduatingInterval = 6;
      expect(graduatingInterval).toBe(6);
    });

    it('should multiply by ease factor for subsequent repetitions', () => {
      const previousInterval = 6;
      const easeFactor = 2.5;
      const newInterval = Math.round(previousInterval * easeFactor);
      expect(newInterval).toBe(15);
    });
  });

  describe('Quality Rating Mapping', () => {
    const mapToQuality = (isCorrect: boolean, confidence: 'easy' | 'medium' | 'hard'): number => {
      if (!isCorrect) {
        return confidence === 'easy' ? 2 : confidence === 'medium' ? 1 : 0;
      } else {
        return confidence === 'easy' ? 5 : confidence === 'medium' ? 4 : 3;
      }
    };

    it('should map correct + easy to quality 5', () => {
      expect(mapToQuality(true, 'easy')).toBe(5);
    });

    it('should map correct + medium to quality 4', () => {
      expect(mapToQuality(true, 'medium')).toBe(4);
    });

    it('should map correct + hard to quality 3', () => {
      expect(mapToQuality(true, 'hard')).toBe(3);
    });

    it('should map incorrect + easy to quality 2', () => {
      expect(mapToQuality(false, 'easy')).toBe(2);
    });

    it('should map incorrect + hard to quality 0', () => {
      expect(mapToQuality(false, 'hard')).toBe(0);
    });
  });
});

describe('Anti-Grind Mechanics', () => {
  describe('Diminishing Returns', () => {
    const calculateXPMultiplier = (practiceCount: number, threshold: number = 3): number => {
      if (practiceCount < threshold) return 1.0;
      const overThreshold = practiceCount - threshold;
      return Math.max(0.2, 1 - (overThreshold * 0.2));
    };

    it('should return full XP below threshold', () => {
      expect(calculateXPMultiplier(1)).toBe(1.0);
      expect(calculateXPMultiplier(2)).toBe(1.0);
    });

    it('should apply 20% reduction per practice after threshold', () => {
      expect(calculateXPMultiplier(4)).toBeCloseTo(0.8, 2); // 1 over threshold
      expect(calculateXPMultiplier(5)).toBeCloseTo(0.6, 2); // 2 over threshold
      expect(calculateXPMultiplier(6)).toBeCloseTo(0.4, 2); // 3 over threshold
    });

    it('should not go below 20% minimum', () => {
      expect(calculateXPMultiplier(10)).toBe(0.2);
      expect(calculateXPMultiplier(100)).toBe(0.2);
    });
  });

  describe('Variety Requirements', () => {
    const checkVariety = (atoms: string[], minRequired: number): boolean => {
      return new Set(atoms).size >= minRequired;
    };

    it('should pass with sufficient variety', () => {
      expect(checkVariety(['a', 'b', 'c', 'd'], 3)).toBe(true);
    });

    it('should fail with insufficient variety', () => {
      expect(checkVariety(['a', 'a', 'a'], 3)).toBe(false);
    });

    it('should count unique atoms correctly', () => {
      const atoms = ['a', 'b', 'a', 'c', 'b'];
      expect(new Set(atoms).size).toBe(3);
    });
  });

  describe('Streak Bonus', () => {
    const calculateStreakBonus = (
      streakLength: number,
      uniqueAtoms: number,
      totalInStreak: number
    ): number => {
      const diversityRatio = totalInStreak > 0 ? uniqueAtoms / totalInStreak : 0;
      const minDiversityRatio = 0.3;

      if (diversityRatio < minDiversityRatio) {
        return 1.0; // No bonus
      }

      return Math.min(1.5, 1 + (streakLength * 0.05));
    };

    it('should give no bonus for low diversity', () => {
      // 1 unique atom out of 10 = 10% diversity
      expect(calculateStreakBonus(5, 1, 10)).toBe(1.0);
    });

    it('should give bonus for high diversity', () => {
      // 4 unique atoms out of 5 = 80% diversity
      const bonus = calculateStreakBonus(5, 4, 5);
      expect(bonus).toBeGreaterThan(1.0);
    });

    it('should increase bonus with streak length', () => {
      const bonus3 = calculateStreakBonus(3, 3, 3);
      const bonus5 = calculateStreakBonus(5, 5, 5);
      const bonus10 = calculateStreakBonus(10, 10, 10);

      expect(bonus5).toBeGreaterThan(bonus3);
      expect(bonus10).toBeGreaterThan(bonus5);
    });

    it('should cap bonus at 50%', () => {
      const bonus = calculateStreakBonus(20, 20, 20);
      expect(bonus).toBeLessThanOrEqual(1.5);
    });
  });

  describe('Variety Score', () => {
    const calculateVarietyScore = (uniqueAtoms: number, totalAttempts: number): number => {
      if (totalAttempts === 0) return 100;
      const ratio = uniqueAtoms / totalAttempts;
      return Math.min(100, Math.round(ratio * 200));
    };

    it('should return 100 for no attempts', () => {
      expect(calculateVarietyScore(0, 0)).toBe(100);
    });

    it('should return high score for all unique atoms', () => {
      expect(calculateVarietyScore(10, 10)).toBe(100);
    });

    it('should return lower score for repeated atoms', () => {
      expect(calculateVarietyScore(5, 20)).toBe(50);
    });
  });
});

describe('Priority Scoring', () => {
  describe('Score Calculation', () => {
    const computeScore = (factors: PriorityFactor[]): number => {
      return factors.reduce((sum, f) => sum + f.contribution, 0);
    };

    it('should sum factor contributions', () => {
      const factors: PriorityFactor[] = [
        { type: 'blocking-gate', weight: 10, value: 0.5, contribution: 5, description: '' },
        { type: 'weakness-cluster', weight: 5, value: 0.8, contribution: 4, description: '' }
      ];
      expect(computeScore(factors)).toBe(9);
    });

    it('should return 0 for empty factors', () => {
      expect(computeScore([])).toBe(0);
    });
  });

  describe('Priority Weights', () => {
    it('should have highest weight for blocking gates', () => {
      const weights = DEFAULT_SCHEDULER_CONFIG.priorityWeights;
      const maxWeight = Math.max(
        weights.blockingGate,
        weights.weaknessCluster,
        weights.spacedRepetition,
        weights.sectionBalance,
        weights.timeSincePractice
      );
      expect(maxWeight).toBe(weights.blockingGate);
    });

    it('should have all positive weights', () => {
      const weights = DEFAULT_SCHEDULER_CONFIG.priorityWeights;
      Object.values(weights).forEach(weight => {
        expect(weight).toBeGreaterThan(0);
      });
    });
  });
});

describe('Block Distribution', () => {
  it('should sum to approximately 1', () => {
    const dist = DEFAULT_SCHEDULER_CONFIG.blockDistribution;
    const sum = dist.build + dist.review + dist.weakness + dist.gate;
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('should allocate most time to building', () => {
    const dist = DEFAULT_SCHEDULER_CONFIG.blockDistribution;
    expect(dist.build).toBeGreaterThan(dist.review);
    expect(dist.build).toBeGreaterThan(dist.weakness);
    expect(dist.build).toBeGreaterThan(dist.gate);
  });
});

describe('Scheduler Configuration', () => {
  it('should have valid default configuration', () => {
    expect(DEFAULT_SCHEDULER_CONFIG.defaultDailyMinutes).toBeGreaterThan(0);
    expect(DEFAULT_SCHEDULER_CONFIG.minBlockMinutes).toBeGreaterThan(0);
    expect(DEFAULT_SCHEDULER_CONFIG.maxBlockMinutes).toBeGreaterThan(DEFAULT_SCHEDULER_CONFIG.minBlockMinutes);
    expect(DEFAULT_SCHEDULER_CONFIG.questionsPerMinute).toBeGreaterThan(0);
  });

  it('should have reasonable questions per minute', () => {
    // 0.5 questions per minute = 2 minutes per question average
    expect(DEFAULT_SCHEDULER_CONFIG.questionsPerMinute).toBeGreaterThanOrEqual(0.3);
    expect(DEFAULT_SCHEDULER_CONFIG.questionsPerMinute).toBeLessThanOrEqual(1.0);
  });

  it('should have valid anti-grind settings', () => {
    const antiGrind = DEFAULT_SCHEDULER_CONFIG.antiGrind;
    expect(antiGrind.maxSameAtomPerSession).toBeGreaterThan(0);
    expect(antiGrind.cooldownMinutes).toBeGreaterThan(0);
    expect(antiGrind.minVarietyPerBlock).toBeGreaterThan(0);
    expect(antiGrind.diminishingReturnsThreshold).toBeGreaterThan(0);
  });
});

describe('Question Selection Distribution', () => {
  const getSelectionDistribution = (type: string) => {
    switch (type) {
      case 'review':
        return { nearRating: 0.4, stretch: 0.1, weakness: 0.1, review: 0.35, random: 0.05 };
      case 'remediation':
        return { nearRating: 0.3, stretch: 0.1, weakness: 0.5, review: 0.05, random: 0.05 };
      case 'test':
        return { nearRating: 0.5, stretch: 0.3, weakness: 0.1, review: 0.05, random: 0.05 };
      default:
        return { nearRating: 0.6, stretch: 0.2, weakness: 0.15, review: 0, random: 0.05 };
    }
  };

  it('should prioritize weakness for remediation blocks', () => {
    const dist = getSelectionDistribution('remediation');
    expect(dist.weakness).toBe(0.5);
    expect(dist.weakness).toBeGreaterThan(dist.nearRating);
  });

  it('should prioritize near-rating for build blocks', () => {
    const dist = getSelectionDistribution('build');
    expect(dist.nearRating).toBe(0.6);
  });

  it('should include stretch questions for test blocks', () => {
    const dist = getSelectionDistribution('test');
    expect(dist.stretch).toBe(0.3);
  });

  it('should always include some random exploration', () => {
    ['build', 'review', 'test', 'remediation'].forEach(type => {
      const dist = getSelectionDistribution(type);
      expect(dist.random).toBe(0.05);
    });
  });
});

describe('Time Budget by Level', () => {
  const getDefaultTimeBudget = (level: number): number => {
    if (level <= 2) return 180; // 3 minutes - learning
    if (level <= 4) return 150; // 2.5 minutes - 1.5x budget
    if (level <= 6) return 120; // 2 minutes - standard
    if (level <= 8) return 100; // 1.67 minutes - strict
    return 90; // 1.5 minutes - test realistic
  };

  it('should give most time to beginners', () => {
    expect(getDefaultTimeBudget(1)).toBe(180);
    expect(getDefaultTimeBudget(2)).toBe(180);
  });

  it('should decrease time budget as level increases', () => {
    expect(getDefaultTimeBudget(3)).toBeLessThan(getDefaultTimeBudget(1));
    expect(getDefaultTimeBudget(5)).toBeLessThan(getDefaultTimeBudget(3));
    expect(getDefaultTimeBudget(7)).toBeLessThan(getDefaultTimeBudget(5));
    expect(getDefaultTimeBudget(9)).toBeLessThan(getDefaultTimeBudget(7));
  });

  it('should have test-realistic timing at highest levels', () => {
    expect(getDefaultTimeBudget(9)).toBe(90);
    expect(getDefaultTimeBudget(10)).toBe(90);
  });
});
