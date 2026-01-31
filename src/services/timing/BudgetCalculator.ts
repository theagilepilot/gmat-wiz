/**
 * Budget Calculator
 * Calculates time budgets based on level and question type
 */

import {
  TimeBudget,
  TimingMode,
  TimedQuestionType,
  STANDARD_TIME_BUDGETS,
  TIME_MULTIPLIERS,
  WARNING_THRESHOLDS,
  STRICT_ENFORCEMENT,
  LEVEL_TO_TIMING_MODE
} from './types';

export class BudgetCalculator {
  /**
   * Get timing mode for a user level
   */
  getTimingMode(level: number): TimingMode {
    // Clamp level to valid range
    const clampedLevel = Math.max(1, Math.min(10, level));
    return LEVEL_TO_TIMING_MODE[clampedLevel];
  }

  /**
   * Calculate time budget for a question
   */
  calculateBudget(
    questionType: TimedQuestionType,
    level: number,
    customMultiplier?: number
  ): TimeBudget {
    const mode = this.getTimingMode(level);
    const standardSeconds = STANDARD_TIME_BUDGETS[questionType];
    
    // Apply mode multiplier and any custom multiplier
    const modeMultiplier = TIME_MULTIPLIERS[mode];
    const finalMultiplier = customMultiplier 
      ? modeMultiplier * customMultiplier 
      : modeMultiplier;
    
    const adjustedSeconds = Math.round(standardSeconds * finalMultiplier);

    return {
      standardSeconds,
      adjustedSeconds,
      warningThreshold: WARNING_THRESHOLDS[mode],
      strictEnforcement: STRICT_ENFORCEMENT[mode],
      mode
    };
  }

  /**
   * Calculate total budget for a block of questions
   */
  calculateBlockBudget(
    questions: Array<{ type: TimedQuestionType }>,
    level: number
  ): {
    totalSeconds: number;
    budgets: TimeBudget[];
    averagePerQuestion: number;
  } {
    const budgets = questions.map(q => this.calculateBudget(q.type, level));
    const totalSeconds = budgets.reduce((sum, b) => sum + b.adjustedSeconds, 0);
    
    return {
      totalSeconds,
      budgets,
      averagePerQuestion: questions.length > 0 
        ? totalSeconds / questions.length 
        : 0
    };
  }

  /**
   * Get recommended pace for a session
   */
  getRecommendedPace(
    level: number,
    targetMinutes: number,
    questionCount: number
  ): {
    secondsPerQuestion: number;
    warningMessage?: string;
  } {
    const mode = this.getTimingMode(level);
    const targetSeconds = targetMinutes * 60;
    const secondsPerQuestion = targetSeconds / questionCount;
    
    // Check if pace is realistic
    const minRealisticSeconds = 60; // At least 1 minute per question
    const maxRealisticSeconds = 300; // At most 5 minutes per question
    
    let warningMessage: string | undefined;
    
    if (secondsPerQuestion < minRealisticSeconds) {
      warningMessage = `Target pace of ${Math.round(secondsPerQuestion)}s per question is very aggressive. Consider more time or fewer questions.`;
    } else if (secondsPerQuestion > maxRealisticSeconds) {
      warningMessage = `Target pace of ${Math.round(secondsPerQuestion)}s per question is slower than needed. You have extra time.`;
    }

    return { secondsPerQuestion, warningMessage };
  }

  /**
   * Categorize time usage
   */
  categorizeTimeUsage(
    actualSeconds: number,
    budgetSeconds: number
  ): 'fast' | 'optimal' | 'slow' | 'overtime' {
    const ratio = actualSeconds / budgetSeconds;
    
    if (ratio > 1.0) return 'overtime';
    if (ratio > 0.8) return 'slow';
    if (ratio < 0.6) return 'fast';
    return 'optimal';
  }

  /**
   * Get time remaining message
   */
  getTimeRemainingMessage(
    remainingSeconds: number,
    budget: TimeBudget
  ): { message: string; urgency: 'none' | 'low' | 'medium' | 'high' } {
    const percentUsed = 1 - (remainingSeconds / budget.adjustedSeconds);
    
    if (remainingSeconds <= 0) {
      return {
        message: budget.strictEnforcement 
          ? 'Time expired!' 
          : 'Over time - consider wrapping up',
        urgency: 'high'
      };
    }
    
    if (percentUsed >= budget.warningThreshold) {
      const secondsLeft = Math.round(remainingSeconds);
      return {
        message: `${secondsLeft}s remaining - ${Math.round((1 - percentUsed) * 100)}% of budget left`,
        urgency: 'medium'
      };
    }
    
    if (percentUsed >= budget.warningThreshold - 0.2) {
      return {
        message: `${Math.round(remainingSeconds)}s remaining`,
        urgency: 'low'
      };
    }
    
    return {
      message: `${Math.round(remainingSeconds)}s remaining`,
      urgency: 'none'
    };
  }

  /**
   * Get level description for UI
   */
  getLevelTimingDescription(level: number): {
    mode: TimingMode;
    description: string;
    multiplier: number;
  } {
    const mode = this.getTimingMode(level);
    const multiplier = TIME_MULTIPLIERS[mode];
    
    const descriptions: Record<TimingMode, string> = {
      'learning': 'Learning mode - take your time to understand concepts',
      'extended': 'Extended time - 50% extra to build confidence',
      'standard': 'Standard timing - warnings help you pace yourself',
      'strict': 'Strict timing - builds test-day discipline',
      'test-realistic': 'Test-realistic - actual GMAT pacing'
    };

    return {
      mode,
      description: descriptions[mode],
      multiplier
    };
  }
}
