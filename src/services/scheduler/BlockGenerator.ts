/**
 * Block Generator
 * Creates training blocks with appropriate question selection
 * Pure logic - no database dependency
 */

import { PriorityScorer, AtomData } from './PriorityScorer.js';
import {
  BlockRequest,
  GeneratedBlock,
  SelectedQuestion,
  SelectionReason,
  BlockType,
  TrainingMode,
  BlockFocus,
  SessionContext,
  PriorityItem,
  DEFAULT_SCHEDULER_CONFIG,
  GateInfo,
  WeaknessInfo
} from './types.js';

/** Question data for selection */
export interface QuestionData {
  id: string;
  atomId: string;
  difficulty: number;
  questionType: string;
  section: 'quant' | 'verbal' | 'di';
}

/** Selection distribution weights */
interface SelectionDistribution {
  nearRating: number;
  stretch: number;
  weakness: number;
  review: number;
  random: number;
}

export class BlockGenerator {
  private config: typeof DEFAULT_SCHEDULER_CONFIG;
  private priorityScorer: PriorityScorer;

  constructor(config?: typeof DEFAULT_SCHEDULER_CONFIG) {
    this.config = config || DEFAULT_SCHEDULER_CONFIG;
    this.priorityScorer = new PriorityScorer(this.config.priorityWeights);
  }

  /**
   * Generate a training block based on request
   */
  generateBlock(
    request: BlockRequest,
    context: SessionContext,
    availableQuestions: QuestionData[],
    atoms: AtomData[]
  ): GeneratedBlock {
    const targetQuestions = request.targetQuestions || 
      Math.floor((request.targetMinutes || 10) * this.config.questionsPerMinute);

    const mode = request.mode || this.determineMode(request.type);
    const focus = this.determineFocus(request, context);
    
    // Get priorities if not targeting specific atoms
    const priorities = request.focusAtoms?.length 
      ? []
      : this.priorityScorer.getTopPriorities(atoms, context, 20);

    // Select questions based on distribution
    const questions = this.selectQuestions(
      request,
      context,
      availableQuestions,
      priorities,
      targetQuestions
    );

    const estimatedMinutes = questions.length / this.config.questionsPerMinute;
    const xpPotential = this.calculateXPPotential(questions, request.type);

    return {
      id: this.generateBlockId(),
      type: request.type,
      mode,
      questions,
      estimatedMinutes,
      focus,
      xpPotential
    };
  }

  /**
   * Determine training mode from block type
   */
  private determineMode(type: BlockType): TrainingMode {
    switch (type) {
      case 'build':
        return 'sprint';
      case 'review':
        return 'review';
      case 'test':
        return 'endurance';
      case 'remediation':
        return 'sprint';
      default:
        return 'mixed';
    }
  }

  /**
   * Determine block focus based on request and context
   */
  private determineFocus(request: BlockRequest, context: SessionContext): BlockFocus {
    if (request.gateId) {
      const gate = context.blockingGates.find((g: GateInfo) => g.gateId === request.gateId);
      return {
        gateId: request.gateId,
        atoms: [gate?.atomId || ''],
        description: `Gate attempt: ${gate?.requirement || 'Unknown gate'}`
      };
    }

    if (request.focusAtoms?.length) {
      return {
        atoms: request.focusAtoms,
        description: `Focused practice on ${request.focusAtoms.length} atom(s)`
      };
    }

    if (request.section) {
      return {
        section: request.section,
        atoms: [],
        description: `${request.section.charAt(0).toUpperCase() + request.section.slice(1)} section practice`
      };
    }

    return {
      atoms: [],
      description: 'Mixed practice'
    };
  }

  /**
   * Select questions based on distribution
   */
  private selectQuestions(
    request: BlockRequest,
    context: SessionContext,
    availableQuestions: QuestionData[],
    priorities: PriorityItem[],
    targetCount: number
  ): SelectedQuestion[] {
    const distribution = this.getDistribution(request.type);
    const selected: SelectedQuestion[] = [];
    const usedQuestionIds = new Set<string>();

    // Track atoms for variety
    const atomCounts = new Map<string, number>();
    const maxPerAtom = this.config.antiGrind.maxSameAtomPerSession;

    // Filter questions based on focus
    let filteredQuestions = this.filterByFocus(availableQuestions, request, context);

    // Calculate how many questions of each type
    const nearRatingCount = Math.floor(targetCount * distribution.nearRating);
    const stretchCount = Math.floor(targetCount * distribution.stretch);
    const weaknessCount = Math.floor(targetCount * distribution.weakness);
    const reviewCount = Math.floor(targetCount * distribution.review);
    const randomCount = targetCount - nearRatingCount - stretchCount - weaknessCount - reviewCount;

    // Select near-rating questions (within ±0.5 of current level)
    const nearRatingQuestions = filteredQuestions.filter(q => 
      Math.abs(q.difficulty - context.currentLevel) <= 0.5
    );
    this.addQuestions(
      selected, nearRatingQuestions, nearRatingCount, 
      'near-rating', usedQuestionIds, atomCounts, maxPerAtom
    );

    // Select stretch questions (0.5-1.5 above current level)
    const stretchQuestions = filteredQuestions.filter(q =>
      q.difficulty > context.currentLevel + 0.5 && 
      q.difficulty <= context.currentLevel + 1.5
    );
    this.addQuestions(
      selected, stretchQuestions, stretchCount,
      'stretch', usedQuestionIds, atomCounts, maxPerAtom
    );

    // Select weakness questions
    const weaknessAtomIds = new Set(context.weaknesses.map((w: WeaknessInfo) => w.atomId));
    const weaknessQuestions = filteredQuestions.filter(q =>
      weaknessAtomIds.has(q.atomId)
    );
    this.addQuestions(
      selected, weaknessQuestions, weaknessCount,
      'weakness', usedQuestionIds, atomCounts, maxPerAtom
    );

    // Select review questions (overdue atoms)
    const reviewAtomIds = new Set(
      priorities.filter(p => p.reviewDue && p.reviewDue <= new Date()).map(p => p.atomId)
    );
    const reviewQuestions = filteredQuestions.filter(q =>
      reviewAtomIds.has(q.atomId)
    );
    this.addQuestions(
      selected, reviewQuestions, reviewCount,
      'review-due', usedQuestionIds, atomCounts, maxPerAtom
    );

    // Fill remaining with random selection
    const remainingQuestions = filteredQuestions.filter(q =>
      !usedQuestionIds.has(q.id)
    );
    this.addQuestions(
      selected, remainingQuestions, randomCount + (targetCount - selected.length),
      'exploration', usedQuestionIds, atomCounts, maxPerAtom
    );

    return selected;
  }

  /**
   * Filter questions based on block focus
   */
  private filterByFocus(
    questions: QuestionData[],
    request: BlockRequest,
    context: SessionContext
  ): QuestionData[] {
    let filtered = [...questions];

    if (request.section) {
      filtered = filtered.filter(q => q.section === request.section);
    }

    if (request.focusAtoms?.length) {
      filtered = filtered.filter(q => request.focusAtoms!.includes(q.atomId));
    }

    if (request.gateId) {
      const gate = context.blockingGates.find((g: GateInfo) => g.gateId === request.gateId);
      if (gate) {
        filtered = filtered.filter(q => q.atomId === gate.atomId);
      }
    }

    return filtered;
  }

  /**
   * Add questions to selection with variety control
   */
  private addQuestions(
    selected: SelectedQuestion[],
    candidates: QuestionData[],
    count: number,
    reason: SelectionReason,
    usedIds: Set<string>,
    atomCounts: Map<string, number>,
    maxPerAtom: number
  ): void {
    // Shuffle candidates for variety
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    for (const q of shuffled) {
      if (selected.length >= count + selected.length - count) break;
      if (usedIds.has(q.id)) continue;

      const atomCount = atomCounts.get(q.atomId) || 0;
      if (atomCount >= maxPerAtom) continue;

      selected.push({
        questionId: q.id,
        atomId: q.atomId,
        difficulty: q.difficulty,
        reason,
        estimatedMinutes: 2 // Default 2 minutes per question
      });

      usedIds.add(q.id);
      atomCounts.set(q.atomId, atomCount + 1);
    }
  }

  /**
   * Get selection distribution for block type
   */
  private getDistribution(type: BlockType): SelectionDistribution {
    switch (type) {
      case 'review':
        return { nearRating: 0.4, stretch: 0.1, weakness: 0.1, review: 0.35, random: 0.05 };
      case 'remediation':
        return { nearRating: 0.3, stretch: 0.1, weakness: 0.5, review: 0.05, random: 0.05 };
      case 'test':
        return { nearRating: 0.5, stretch: 0.3, weakness: 0.1, review: 0.05, random: 0.05 };
      case 'build':
      default:
        return { nearRating: 0.6, stretch: 0.2, weakness: 0.15, review: 0, random: 0.05 };
    }
  }

  /**
   * Calculate XP potential for block
   */
  private calculateXPPotential(questions: SelectedQuestion[], type: BlockType): number {
    const baseXP = questions.length * 10;
    const typeMultiplier = type === 'test' ? 1.5 : type === 'remediation' ? 0.8 : 1;
    return Math.round(baseXP * typeMultiplier);
  }

  /**
   * Generate unique block ID
   */
  private generateBlockId(): string {
    return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
