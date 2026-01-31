/**
 * Anti-Grind Mechanics
 * Prevents XP farming through variety requirements and cooldowns
 * Pure logic - no database dependency
 */

import { AntiGrindConfig, DEFAULT_SCHEDULER_CONFIG } from './types';

/** Practice attempt for anti-grind tracking */
export interface PracticeAttempt {
  atomId: string;
  timestamp: Date;
  isCorrect: boolean;
  xpEarned: number;
}

/** Session tracking for anti-grind */
export interface SessionTracking {
  startTime: Date;
  attempts: PracticeAttempt[];
  atomCounts: Map<string, number>;
  streakLength: number;
  streakAtoms: Set<string>;
}

/**
 * AntiGrind - XP farming prevention
 */
export class AntiGrind {
  private config: AntiGrindConfig;

  constructor(config?: AntiGrindConfig) {
    this.config = config || DEFAULT_SCHEDULER_CONFIG.antiGrind;
  }

  /**
   * Check if user can practice an atom (cooldown check)
   */
  canPracticeAtom(
    atomId: string,
    recentAttempts: PracticeAttempt[],
    sessionAtomCounts: Map<string, number>
  ): { allowed: boolean; reason?: string; cooldownRemaining?: number } {
    // Check session limit
    const sessionCount = sessionAtomCounts.get(atomId) || 0;
    if (sessionCount >= this.config.maxSameAtomPerSession) {
      return {
        allowed: false,
        reason: `Already practiced ${sessionCount} times this session. Try other topics.`
      };
    }

    // Check cooldown
    const recentForAtom = recentAttempts
      .filter(a => a.atomId === atomId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (recentForAtom.length >= this.config.maxSameAtomPerSession) {
      const lastAttempt = recentForAtom[0];
      const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
      const timeSince = Date.now() - lastAttempt.timestamp.getTime();

      if (timeSince < cooldownMs) {
        return {
          allowed: false,
          reason: 'Atom on cooldown. Practice other topics first.',
          cooldownRemaining: Math.ceil((cooldownMs - timeSince) / 60000)
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Calculate XP with diminishing returns
   */
  calculateXP(
    baseXP: number,
    atomId: string,
    sessionAtomCounts: Map<string, number>,
    isCorrect: boolean
  ): { xp: number; multiplier: number; reason?: string } {
    if (!isCorrect) {
      return { xp: Math.round(baseXP * 0.2), multiplier: 0.2, reason: 'Incorrect answer' };
    }

    const practiceCount = sessionAtomCounts.get(atomId) || 0;
    const threshold = this.config.diminishingReturnsThreshold;

    let multiplier = 1.0;
    let reason: string | undefined;

    if (practiceCount >= threshold) {
      const overThreshold = practiceCount - threshold;
      multiplier = Math.max(0.2, 1 - (overThreshold * 0.2));
      reason = `Diminishing returns: ${Math.round(multiplier * 100)}% XP`;
    }

    return {
      xp: Math.round(baseXP * multiplier),
      multiplier,
      reason
    };
  }

  /**
   * Check variety requirements for a block
   */
  checkVarietyRequirement(
    attempts: PracticeAttempt[],
    minVariety?: number
  ): { passed: boolean; uniqueAtoms: number; required: number } {
    const required = minVariety || this.config.minVarietyPerBlock;
    const uniqueAtoms = new Set(attempts.map(a => a.atomId)).size;

    return {
      passed: uniqueAtoms >= required,
      uniqueAtoms,
      required
    };
  }

  /**
   * Calculate streak bonus with diversity requirement
   */
  calculateStreakBonus(
    streakLength: number,
    streakAtoms: Set<string>,
    totalInStreak: number
  ): { bonus: number; diversityMet: boolean } {
    const diversityRatio = totalInStreak > 0 
      ? streakAtoms.size / totalInStreak 
      : 0;

    const minDiversityRatio = 0.3; // Need 30% unique atoms in streak

    if (diversityRatio < minDiversityRatio) {
      return { bonus: 1.0, diversityMet: false };
    }

    // 5% bonus per correct answer in streak, max 50%
    const bonus = Math.min(1.5, 1 + (streakLength * 0.05));
    return { bonus, diversityMet: true };
  }

  /**
   * Calculate variety score for a session
   */
  calculateVarietyScore(attempts: PracticeAttempt[]): number {
    if (attempts.length === 0) return 100;

    const uniqueAtoms = new Set(attempts.map(a => a.atomId)).size;
    const ratio = uniqueAtoms / attempts.length;

    // 50% unique = 100 score, less unique = lower score
    return Math.min(100, Math.round(ratio * 200));
  }

  /**
   * Get recommendations for variety
   */
  getVarietyRecommendations(
    sessionAtomCounts: Map<string, number>,
    availableAtoms: string[]
  ): string[] {
    const practiced = new Set(sessionAtomCounts.keys());
    const notPracticed = availableAtoms.filter(a => !practiced.has(a));

    // Recommend up to 3 atoms that haven't been practiced
    return notPracticed.slice(0, 3);
  }

  /**
   * Get session health metrics
   */
  getSessionHealth(tracking: SessionTracking): {
    varietyScore: number;
    grindDetected: boolean;
    recommendations: string[];
  } {
    const varietyScore = this.calculateVarietyScore(tracking.attempts);
    
    // Grind detection: same atom more than half the time
    let maxCount = 0;
    for (const count of tracking.atomCounts.values()) {
      maxCount = Math.max(maxCount, count);
    }
    const grindDetected = tracking.attempts.length > 5 && 
      maxCount > tracking.attempts.length * 0.5;

    const recommendations: string[] = [];

    if (grindDetected) {
      recommendations.push('Try practicing different topics for better retention');
    }

    if (varietyScore < 50) {
      recommendations.push('Mix in some different question types');
    }

    return { varietyScore, grindDetected, recommendations };
  }
}

/**
 * Cooldowns - Manages atom and gate cooldowns
 */
export class Cooldowns {
  private atomCooldowns: Map<string, Date> = new Map();
  private gateCooldowns: Map<string, Date> = new Map();
  private config: AntiGrindConfig;

  constructor(config?: AntiGrindConfig) {
    this.config = config || DEFAULT_SCHEDULER_CONFIG.antiGrind;
  }

  /**
   * Set cooldown for an atom
   */
  setAtomCooldown(atomId: string, minutes?: number): void {
    const cooldownMs = (minutes || this.config.cooldownMinutes) * 60 * 1000;
    this.atomCooldowns.set(atomId, new Date(Date.now() + cooldownMs));
  }

  /**
   * Check if atom is on cooldown
   */
  isAtomOnCooldown(atomId: string): { onCooldown: boolean; remainingMinutes?: number } {
    const cooldownEnd = this.atomCooldowns.get(atomId);
    
    if (!cooldownEnd) {
      return { onCooldown: false };
    }

    const now = Date.now();
    if (cooldownEnd.getTime() <= now) {
      this.atomCooldowns.delete(atomId);
      return { onCooldown: false };
    }

    return {
      onCooldown: true,
      remainingMinutes: Math.ceil((cooldownEnd.getTime() - now) / 60000)
    };
  }

  /**
   * Set cooldown for a gate attempt
   */
  setGateCooldown(gateId: string, minutes: number = 30): void {
    const cooldownMs = minutes * 60 * 1000;
    this.gateCooldowns.set(gateId, new Date(Date.now() + cooldownMs));
  }

  /**
   * Check if gate is on cooldown
   */
  isGateOnCooldown(gateId: string): { onCooldown: boolean; remainingMinutes?: number } {
    const cooldownEnd = this.gateCooldowns.get(gateId);
    
    if (!cooldownEnd) {
      return { onCooldown: false };
    }

    const now = Date.now();
    if (cooldownEnd.getTime() <= now) {
      this.gateCooldowns.delete(gateId);
      return { onCooldown: false };
    }

    return {
      onCooldown: true,
      remainingMinutes: Math.ceil((cooldownEnd.getTime() - now) / 60000)
    };
  }

  /**
   * Clear all cooldowns (for testing or session reset)
   */
  clearAll(): void {
    this.atomCooldowns.clear();
    this.gateCooldowns.clear();
  }

  /**
   * Get all active cooldowns
   */
  getActiveCooldowns(): {
    atoms: Array<{ atomId: string; remainingMinutes: number }>;
    gates: Array<{ gateId: string; remainingMinutes: number }>;
  } {
    const now = Date.now();
    const atoms: Array<{ atomId: string; remainingMinutes: number }> = [];
    const gates: Array<{ gateId: string; remainingMinutes: number }> = [];

    for (const [atomId, cooldownEnd] of this.atomCooldowns) {
      if (cooldownEnd.getTime() > now) {
        atoms.push({
          atomId,
          remainingMinutes: Math.ceil((cooldownEnd.getTime() - now) / 60000)
        });
      }
    }

    for (const [gateId, cooldownEnd] of this.gateCooldowns) {
      if (cooldownEnd.getTime() > now) {
        gates.push({
          gateId,
          remainingMinutes: Math.ceil((cooldownEnd.getTime() - now) / 60000)
        });
      }
    }

    return { atoms, gates };
  }
}
