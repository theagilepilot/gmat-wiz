/**
 * Priority Scorer
 * Calculates priority scores for atoms based on multiple factors
 * Pure logic - no database dependency
 */

import {
  PriorityItem,
  PriorityFactor,
  PriorityFactorType,
  PriorityWeights,
  SessionContext,
  DEFAULT_SCHEDULER_CONFIG
} from './types';

/** Atom data for priority calculation */
export interface AtomData {
  id: string;
  name: string;
  section: 'quant' | 'verbal' | 'di';
  lastPracticed?: Date;
  reviewDue?: Date;
  attemptCount: number;
  accuracy: number;
  mastery: number;
}

export class PriorityScorer {
  private weights: PriorityWeights;

  constructor(weights?: PriorityWeights) {
    this.weights = weights || DEFAULT_SCHEDULER_CONFIG.priorityWeights;
  }

  /**
   * Calculate priority scores for atoms
   */
  calculatePriorities(atoms: AtomData[], context: SessionContext): PriorityItem[] {
    const priorities: PriorityItem[] = [];

    for (const atom of atoms) {
      const factors = this.calculateFactors(atom, context);
      const score = this.computeScore(factors);

      priorities.push({
        atomId: atom.id,
        atomName: atom.name,
        section: atom.section,
        score,
        factors,
        lastPracticed: atom.lastPracticed,
        reviewDue: atom.reviewDue
      });
    }

    // Sort by score descending
    return priorities.sort((a, b) => b.score - a.score);
  }

  /**
   * Get top N priorities
   */
  getTopPriorities(atoms: AtomData[], context: SessionContext, count: number): PriorityItem[] {
    return this.calculatePriorities(atoms, context).slice(0, count);
  }

  /**
   * Calculate all priority factors for an atom
   */
  private calculateFactors(atom: AtomData, context: SessionContext): PriorityFactor[] {
    const factors: PriorityFactor[] = [];

    // 1. Blocking gate factor
    const gateFactor = this.calculateBlockingGateFactor(atom, context);
    if (gateFactor) factors.push(gateFactor);

    // 2. Weakness cluster factor
    const weaknessFactor = this.calculateWeaknessFactor(atom, context);
    if (weaknessFactor) factors.push(weaknessFactor);

    // 3. Spaced repetition factor
    const spacedRepFactor = this.calculateSpacedRepFactor(atom);
    if (spacedRepFactor) factors.push(spacedRepFactor);

    // 4. Section balance factor
    const balanceFactor = this.calculateSectionBalanceFactor(atom, context);
    if (balanceFactor) factors.push(balanceFactor);

    // 5. Time since practice factor
    const timeFactor = this.calculateTimeSincePracticeFactor(atom);
    if (timeFactor) factors.push(timeFactor);

    // 6. Error frequency factor
    const errorFactor = this.calculateErrorFrequencyFactor(atom);
    if (errorFactor) factors.push(errorFactor);

    // 7. Low mastery factor
    const masteryFactor = this.calculateLowMasteryFactor(atom);
    if (masteryFactor) factors.push(masteryFactor);

    return factors;
  }

  /**
   * Compute total score from factors
   */
  private computeScore(factors: PriorityFactor[]): number {
    return factors.reduce((sum, f) => sum + f.contribution, 0);
  }

  private calculateBlockingGateFactor(atom: AtomData, context: SessionContext): PriorityFactor | null {
    const blockingGate = context.blockingGates.find(g => g.atomId === atom.id);
    
    if (!blockingGate) return null;

    // Higher priority for gates closer to completion
    const progressGap = blockingGate.targetProgress - blockingGate.currentProgress;
    const value = progressGap > 0 ? 1 - progressGap : 1;
    const contribution = this.weights.blockingGate * value;

    return {
      type: 'blocking-gate',
      weight: this.weights.blockingGate,
      value,
      contribution,
      description: `Blocking gate: ${blockingGate.requirement}`
    };
  }

  private calculateWeaknessFactor(atom: AtomData, context: SessionContext): PriorityFactor | null {
    const weakness = context.weaknesses.find(w => w.atomId === atom.id);
    
    if (!weakness) return null;

    // Higher priority for more severe weaknesses
    const value = weakness.severity;
    const contribution = this.weights.weaknessCluster * value;

    return {
      type: 'weakness-cluster',
      weight: this.weights.weaknessCluster,
      value,
      contribution,
      description: `Weakness: ${weakness.pattern} (${Math.round(weakness.severity * 100)}%)`
    };
  }

  private calculateSpacedRepFactor(atom: AtomData): PriorityFactor | null {
    if (!atom.reviewDue) return null;

    const now = new Date();
    const daysOverdue = Math.floor(
      (now.getTime() - atom.reviewDue.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysOverdue < 0) return null; // Not due yet

    // Value increases with how overdue the review is
    const value = Math.min(1, daysOverdue / 7); // Max out at 1 week overdue
    const contribution = this.weights.spacedRepetition * value;

    return {
      type: 'spaced-repetition',
      weight: this.weights.spacedRepetition,
      value,
      contribution,
      description: daysOverdue === 0 ? 'Review due today' : `Review ${daysOverdue} days overdue`
    };
  }

  private calculateSectionBalanceFactor(atom: AtomData, context: SessionContext): PriorityFactor | null {
    // Check if this section is underrepresented in recent practice
    const sectionCounts = context.recentAtoms.reduce((acc, a) => {
      const section = a.split('-')[0] as 'quant' | 'verbal' | 'di';
      acc[section] = (acc[section] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = context.recentAtoms.length || 1;
    const sectionRatio = (sectionCounts[atom.section] || 0) / total;
    const targetRatio = atom.section === 'di' ? 0.2 : 0.4; // DI is smaller portion

    if (sectionRatio >= targetRatio) return null;

    const value = 1 - (sectionRatio / targetRatio);
    const contribution = this.weights.sectionBalance * value;

    return {
      type: 'section-balance',
      weight: this.weights.sectionBalance,
      value,
      contribution,
      description: `${atom.section} underrepresented (${Math.round(sectionRatio * 100)}% vs ${Math.round(targetRatio * 100)}% target)`
    };
  }

  private calculateTimeSincePracticeFactor(atom: AtomData): PriorityFactor | null {
    if (!atom.lastPracticed) {
      // Never practiced - high priority
      return {
        type: 'time-since-practice',
        weight: this.weights.timeSincePractice,
        value: 1,
        contribution: this.weights.timeSincePractice,
        description: 'Never practiced'
      };
    }

    const now = new Date();
    const daysSince = Math.floor(
      (now.getTime() - atom.lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince < 1) return null; // Practiced today

    const value = Math.min(1, daysSince / 14); // Max at 2 weeks
    const contribution = this.weights.timeSincePractice * value;

    return {
      type: 'time-since-practice',
      weight: this.weights.timeSincePractice,
      value,
      contribution,
      description: `Last practiced ${daysSince} days ago`
    };
  }

  private calculateErrorFrequencyFactor(atom: AtomData): PriorityFactor | null {
    if (atom.attemptCount < 3) return null; // Not enough data

    const errorRate = 1 - atom.accuracy;
    if (errorRate < 0.3) return null; // Good accuracy

    const value = Math.min(1, errorRate * 1.5); // Amplify error rate
    const contribution = (this.weights.errorFrequency || 4) * value;

    return {
      type: 'error-frequency',
      weight: this.weights.errorFrequency || 4,
      value,
      contribution,
      description: `High error rate: ${Math.round(errorRate * 100)}%`
    };
  }

  private calculateLowMasteryFactor(atom: AtomData): PriorityFactor | null {
    if (atom.mastery >= 0.5) return null; // Sufficient mastery

    const value = 1 - (atom.mastery * 2); // 0% mastery = 1, 50% mastery = 0
    const contribution = (this.weights.lowMastery || 3) * value;

    return {
      type: 'low-mastery',
      weight: this.weights.lowMastery || 3,
      value,
      contribution,
      description: `Low mastery: ${Math.round(atom.mastery * 100)}%`
    };
  }
}
