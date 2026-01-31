/**
 * Daily Planner
 * Generates daily training plans based on user context and goals
 * Pure logic - no database dependency
 */

import { PriorityScorer, AtomData } from './PriorityScorer.js';
import { BlockGenerator, QuestionData } from './BlockGenerator.js';
import {
  DailyPlan,
  PlannedBlock,
  BlockType,
  SessionContext,
  PriorityItem,
  DEFAULT_SCHEDULER_CONFIG,
  BlockDistribution,
  WeaknessInfo
} from './types.js';

export class DailyPlanner {
  private config: typeof DEFAULT_SCHEDULER_CONFIG;
  private priorityScorer: PriorityScorer;
  private blockGenerator: BlockGenerator;

  constructor(config?: typeof DEFAULT_SCHEDULER_CONFIG) {
    this.config = config || DEFAULT_SCHEDULER_CONFIG;
    this.priorityScorer = new PriorityScorer(this.config.priorityWeights);
    this.blockGenerator = new BlockGenerator(this.config);
  }

  /**
   * Generate a daily plan for a user
   */
  generateDailyPlan(
    userId: string,
    context: SessionContext,
    atoms: AtomData[],
    targetMinutes?: number
  ): DailyPlan {
    const minutes = targetMinutes || this.config.defaultDailyMinutes;
    const priorities = this.priorityScorer.calculatePriorities(atoms, context);

    // Determine block distribution
    const blocks = this.planBlocks(context, priorities, minutes);

    return {
      id: this.generatePlanId(),
      userId,
      date: this.getTodayDate(),
      targetMinutes: minutes,
      blocks,
      priorities: priorities.slice(0, 10), // Top 10 priorities
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Plan blocks based on priorities and available time
   */
  private planBlocks(
    context: SessionContext,
    priorities: PriorityItem[],
    targetMinutes: number
  ): PlannedBlock[] {
    const blocks: PlannedBlock[] = [];
    let remainingMinutes = targetMinutes - context.completedToday.minutes;

    if (remainingMinutes <= 0) {
      return blocks; // Already hit target
    }

    const distribution = this.adjustDistribution(context);

    // 1. Gate blocks (if blocking gates exist)
    if (context.blockingGates.length > 0 && distribution.gate > 0) {
      const gateMinutes = Math.min(
        Math.round(targetMinutes * distribution.gate),
        remainingMinutes,
        this.config.maxBlockMinutes
      );

      if (gateMinutes >= this.config.minBlockMinutes) {
        const gateBlock = this.createGateBlock(context, priorities, gateMinutes);
        blocks.push(gateBlock);
        remainingMinutes -= gateMinutes;
      }
    }

    // 2. Weakness blocks (if significant weaknesses)
    if (context.weaknesses.length > 0 && distribution.weakness > 0 && remainingMinutes > 0) {
      const weaknessMinutes = Math.min(
        Math.round(targetMinutes * distribution.weakness),
        remainingMinutes,
        this.config.maxBlockMinutes
      );

      if (weaknessMinutes >= this.config.minBlockMinutes) {
        const weaknessBlock = this.createWeaknessBlock(context, priorities, weaknessMinutes);
        blocks.push(weaknessBlock);
        remainingMinutes -= weaknessMinutes;
      }
    }

    // 3. Review blocks (if reviews are due)
    const reviewDue = priorities.filter(p => p.reviewDue && p.reviewDue <= new Date());
    if (reviewDue.length > 0 && distribution.review > 0 && remainingMinutes > 0) {
      const reviewMinutes = Math.min(
        Math.round(targetMinutes * distribution.review),
        remainingMinutes,
        this.config.maxBlockMinutes
      );

      if (reviewMinutes >= this.config.minBlockMinutes) {
        const reviewBlock = this.createReviewBlock(context, reviewDue, reviewMinutes);
        blocks.push(reviewBlock);
        remainingMinutes -= reviewMinutes;
      }
    }

    // 4. Build blocks (fill remaining time)
    while (remainingMinutes >= this.config.minBlockMinutes) {
      const buildMinutes = Math.min(remainingMinutes, this.config.maxBlockMinutes);
      const buildBlock = this.createBuildBlock(context, priorities, buildMinutes);
      blocks.push(buildBlock);
      remainingMinutes -= buildMinutes;
    }

    // Order blocks optimally
    return this.orderBlocks(blocks);
  }

  /**
   * Adjust distribution based on context
   */
  private adjustDistribution(context: SessionContext): BlockDistribution {
    const base = { ...this.config.blockDistribution };

    // If no blocking gates, redistribute that time
    if (context.blockingGates.length === 0) {
      base.build += base.gate;
      base.gate = 0;
    }

    // If no weaknesses, redistribute
    if (context.weaknesses.length === 0) {
      base.build += base.weakness * 0.5;
      base.review += base.weakness * 0.5;
      base.weakness = 0;
    }

    return base;
  }

  /**
   * Create a gate-focused block
   */
  private createGateBlock(
    context: SessionContext,
    priorities: PriorityItem[],
    minutes: number
  ): PlannedBlock {
    const gate = context.blockingGates[0];
    const atomPriority = priorities.find(p => p.atomId === gate.atomId);

    return {
      id: this.generateBlockId(),
      type: 'gate' as BlockType,
      targetMinutes: minutes,
      targetQuestions: Math.floor(minutes * this.config.questionsPerMinute),
      priority: 1, // Highest priority
      focusAtoms: [gate.atomId],
      gateId: gate.gateId,
      reason: `Clear blocking gate: ${gate.requirement}`,
      estimatedXP: Math.round(minutes * 5 * 1.5) // Gate bonus
    };
  }

  /**
   * Create a weakness-focused block
   */
  private createWeaknessBlock(
    context: SessionContext,
    priorities: PriorityItem[],
    minutes: number
  ): PlannedBlock {
    // Get top weakness atoms
    const weaknessAtoms = context.weaknesses
      .sort((a: WeaknessInfo, b: WeaknessInfo) => b.priority - a.priority)
      .slice(0, 3)
      .map((w: WeaknessInfo) => w.atomId);

    return {
      id: this.generateBlockId(),
      type: 'remediation' as BlockType,
      targetMinutes: minutes,
      targetQuestions: Math.floor(minutes * this.config.questionsPerMinute),
      priority: 2,
      focusAtoms: weaknessAtoms,
      reason: `Address weakness in ${weaknessAtoms.length} area(s)`,
      estimatedXP: Math.round(minutes * 5 * 0.8) // Reduced for remediation
    };
  }

  /**
   * Create a review block
   */
  private createReviewBlock(
    context: SessionContext,
    reviewDue: PriorityItem[],
    minutes: number
  ): PlannedBlock {
    const reviewAtoms = reviewDue
      .slice(0, 5)
      .map(p => p.atomId);

    return {
      id: this.generateBlockId(),
      type: 'review' as BlockType,
      targetMinutes: minutes,
      targetQuestions: Math.floor(minutes * this.config.questionsPerMinute),
      priority: 3,
      focusAtoms: reviewAtoms,
      reason: `${reviewDue.length} review(s) due`,
      estimatedXP: Math.round(minutes * 5)
    };
  }

  /**
   * Create a build block
   */
  private createBuildBlock(
    context: SessionContext,
    priorities: PriorityItem[],
    minutes: number
  ): PlannedBlock {
    // Focus on highest priority atoms not in other blocks
    const topAtoms = priorities.slice(0, 5).map(p => p.atomId);

    return {
      id: this.generateBlockId(),
      type: 'build' as BlockType,
      targetMinutes: minutes,
      targetQuestions: Math.floor(minutes * this.config.questionsPerMinute),
      priority: 4,
      focusAtoms: topAtoms,
      reason: 'Build skills with new material',
      estimatedXP: Math.round(minutes * 5)
    };
  }

  /**
   * Order blocks for optimal learning
   */
  private orderBlocks(blocks: PlannedBlock[]): PlannedBlock[] {
    // Order: Gate -> Weakness -> Build -> Review
    // This puts harder work first when energy is highest
    const typeOrder: BlockType[] = ['gate', 'remediation', 'build', 'review', 'test'];
    
    return blocks.sort((a, b) => {
      const aIndex = typeOrder.indexOf(a.type);
      const bIndex = typeOrder.indexOf(b.type);
      return aIndex - bIndex;
    });
  }

  /**
   * Get today's date as YYYY-MM-DD
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique block ID
   */
  private generateBlockId(): string {
    return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
