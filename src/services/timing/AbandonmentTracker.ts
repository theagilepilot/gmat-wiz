/**
 * Abandonment Tracker
 * Tracks and analyzes question abandonment patterns
 */

import {
  AbandonmentEvent,
  TimedQuestionType,
  STANDARD_TIME_BUDGETS
} from './types';

/** Abandonment statistics */
export interface AbandonmentStats {
  totalAbandoned: number;
  averageTimeBeforeAbandonment: number;
  averagePercentBudgetUsed: number;
  strategicGuessRate: number;
  byQuestionType: Map<TimedQuestionType, {
    count: number;
    averageTime: number;
    averagePercent: number;
  }>;
  byReason: Map<string, number>;
}

/** Abandonment pattern */
export interface AbandonmentPattern {
  type: 'early-abandon' | 'late-struggle' | 'strategic' | 'mixed';
  description: string;
  frequency: number;
  questionTypes: TimedQuestionType[];
}

export class AbandonmentTracker {
  private events: AbandonmentEvent[] = [];
  private strategicThreshold: number;
  private earlyAbandonThreshold: number;

  constructor(
    strategicThreshold: number = 0.7,  // 70% of budget = strategic
    earlyAbandonThreshold: number = 0.3 // < 30% = early abandon
  ) {
    this.strategicThreshold = strategicThreshold;
    this.earlyAbandonThreshold = earlyAbandonThreshold;
  }

  /**
   * Record an abandonment event
   */
  recordAbandonment(
    questionId: string,
    questionType: TimedQuestionType,
    timeBeforeAbandonMs: number,
    reason?: 'timeout' | 'gave-up' | 'skipped' | 'strategic'
  ): AbandonmentEvent {
    const budgetSeconds = STANDARD_TIME_BUDGETS[questionType];
    const percentBudgetUsed = (timeBeforeAbandonMs / 1000) / budgetSeconds;
    
    // Determine if strategic
    const wasStrategicGuess = reason === 'strategic' || 
      (percentBudgetUsed >= this.strategicThreshold && reason !== 'gave-up');

    const event: AbandonmentEvent = {
      questionId,
      questionType,
      timeBeforeAbandonMs,
      percentBudgetUsed: percentBudgetUsed * 100,
      wasStrategicGuess,
      reason: reason || this.inferReason(percentBudgetUsed)
    };

    this.events.push(event);
    return event;
  }

  /**
   * Get abandonment statistics
   */
  getStats(): AbandonmentStats {
    if (this.events.length === 0) {
      return {
        totalAbandoned: 0,
        averageTimeBeforeAbandonment: 0,
        averagePercentBudgetUsed: 0,
        strategicGuessRate: 0,
        byQuestionType: new Map(),
        byReason: new Map()
      };
    }

    const totalAbandoned = this.events.length;
    const averageTimeBeforeAbandonment = 
      this.events.reduce((sum, e) => sum + e.timeBeforeAbandonMs, 0) / totalAbandoned / 1000;
    const averagePercentBudgetUsed =
      this.events.reduce((sum, e) => sum + e.percentBudgetUsed, 0) / totalAbandoned;
    const strategicGuessRate =
      this.events.filter(e => e.wasStrategicGuess).length / totalAbandoned;

    // Stats by question type
    const byQuestionType = new Map<TimedQuestionType, {
      count: number;
      averageTime: number;
      averagePercent: number;
    }>();

    const typeGroups = this.groupByType();
    for (const [type, events] of typeGroups) {
      byQuestionType.set(type, {
        count: events.length,
        averageTime: events.reduce((sum, e) => sum + e.timeBeforeAbandonMs, 0) / events.length / 1000,
        averagePercent: events.reduce((sum, e) => sum + e.percentBudgetUsed, 0) / events.length
      });
    }

    // Stats by reason
    const byReason = new Map<string, number>();
    for (const event of this.events) {
      const reason = event.reason || 'unknown';
      byReason.set(reason, (byReason.get(reason) || 0) + 1);
    }

    return {
      totalAbandoned,
      averageTimeBeforeAbandonment,
      averagePercentBudgetUsed,
      strategicGuessRate,
      byQuestionType,
      byReason
    };
  }

  /**
   * Identify abandonment patterns
   */
  identifyPatterns(): AbandonmentPattern[] {
    const patterns: AbandonmentPattern[] = [];

    if (this.events.length < 3) {
      return patterns;
    }

    // Check for early abandonment pattern
    const earlyAbandons = this.events.filter(
      e => e.percentBudgetUsed < this.earlyAbandonThreshold * 100
    );
    if (earlyAbandons.length >= 2) {
      const types = [...new Set(earlyAbandons.map(e => e.questionType))];
      patterns.push({
        type: 'early-abandon',
        description: 'Tendency to give up quickly on challenging questions',
        frequency: earlyAbandons.length / this.events.length,
        questionTypes: types
      });
    }

    // Check for late struggle pattern
    const lateStruggles = this.events.filter(
      e => e.percentBudgetUsed > 100 && !e.wasStrategicGuess
    );
    if (lateStruggles.length >= 2) {
      const types = [...new Set(lateStruggles.map(e => e.questionType))];
      patterns.push({
        type: 'late-struggle',
        description: 'Spending too much time before abandoning difficult questions',
        frequency: lateStruggles.length / this.events.length,
        questionTypes: types
      });
    }

    // Check for strategic pattern (good!)
    const strategicAbandons = this.events.filter(e => e.wasStrategicGuess);
    if (strategicAbandons.length >= 2) {
      const types = [...new Set(strategicAbandons.map(e => e.questionType))];
      patterns.push({
        type: 'strategic',
        description: 'Good use of strategic guessing to maintain pace',
        frequency: strategicAbandons.length / this.events.length,
        questionTypes: types
      });
    }

    return patterns;
  }

  /**
   * Get recommendations for abandonment behavior
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();
    const patterns = this.identifyPatterns();

    // Check strategic guess rate
    if (stats.strategicGuessRate < 0.3 && stats.totalAbandoned > 5) {
      recommendations.push(
        'Consider making strategic guesses earlier when stuck. The GMAT penalizes incomplete sections.'
      );
    }

    // Check for early abandons
    const earlyPattern = patterns.find(p => p.type === 'early-abandon');
    if (earlyPattern && earlyPattern.frequency > 0.3) {
      recommendations.push(
        `You often abandon ${earlyPattern.questionTypes.join(', ')} questions quickly. Try spending a bit more time - you might solve them.`
      );
    }

    // Check for late struggles
    const latePattern = patterns.find(p => p.type === 'late-struggle');
    if (latePattern && latePattern.frequency > 0.3) {
      recommendations.push(
        'When a question takes more than 1.5x the budget, consider making an educated guess and moving on.'
      );
    }

    // Type-specific recommendations
    for (const [type, typeStats] of stats.byQuestionType) {
      if (typeStats.count >= 3 && typeStats.averagePercent > 100) {
        recommendations.push(
          `${type.replace(/-/g, ' ')} questions cause overtime. Review strategies for this type.`
        );
      }
    }

    return recommendations;
  }

  /**
   * Calculate optimal abandonment threshold for a question type
   */
  getOptimalAbandonThreshold(questionType: TimedQuestionType): {
    recommendedPercent: number;
    reasoning: string;
  } {
    const typeEvents = this.events.filter(e => e.questionType === questionType);
    
    if (typeEvents.length < 5) {
      return {
        recommendedPercent: 80,
        reasoning: 'Default threshold - not enough data for personalized recommendation'
      };
    }

    // Find the percent where strategic guesses were most successful
    // (In reality, this would correlate with success data)
    const strategicEvents = typeEvents.filter(e => e.wasStrategicGuess);
    
    if (strategicEvents.length > 0) {
      const avgStrategicPercent = 
        strategicEvents.reduce((sum, e) => sum + e.percentBudgetUsed, 0) / strategicEvents.length;
      
      return {
        recommendedPercent: Math.round(avgStrategicPercent),
        reasoning: `Based on your ${strategicEvents.length} strategic guesses on this type`
      };
    }

    return {
      recommendedPercent: 75,
      reasoning: 'Consider guessing at 75% of time budget if stuck'
    };
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get all events
   */
  getEvents(): AbandonmentEvent[] {
    return [...this.events];
  }

  /**
   * Infer reason from percent budget used
   */
  private inferReason(percentBudgetUsed: number): 'timeout' | 'gave-up' | 'skipped' | 'strategic' {
    if (percentBudgetUsed >= 1.0) return 'timeout';
    if (percentBudgetUsed >= this.strategicThreshold) return 'strategic';
    if (percentBudgetUsed < this.earlyAbandonThreshold) return 'skipped';
    return 'gave-up';
  }

  /**
   * Group events by question type
   */
  private groupByType(): Map<TimedQuestionType, AbandonmentEvent[]> {
    const groups = new Map<TimedQuestionType, AbandonmentEvent[]>();
    
    for (const event of this.events) {
      if (!groups.has(event.questionType)) {
        groups.set(event.questionType, []);
      }
      groups.get(event.questionType)!.push(event);
    }

    return groups;
  }
}
