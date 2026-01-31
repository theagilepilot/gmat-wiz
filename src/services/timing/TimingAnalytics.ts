/**
 * Timing Analytics
 * Analyzes timing patterns and generates statistics
 */

import {
  TimingResult,
  TimingStats,
  SessionTimingSummary,
  TimedQuestionType,
  TimingAnalyticsConfig,
  DEFAULT_ANALYTICS_CONFIG,
  STANDARD_TIME_BUDGETS
} from './types';

export class TimingAnalytics {
  private config: TimingAnalyticsConfig;
  private results: TimingResult[] = [];

  constructor(config?: Partial<TimingAnalyticsConfig>) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
  }

  /**
   * Add a timing result for analysis
   */
  addResult(result: TimingResult): void {
    this.results.push(result);
  }

  /**
   * Add multiple results
   */
  addResults(results: TimingResult[]): void {
    this.results.push(...results);
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Get statistics for a specific question type
   */
  getStatsByType(questionType: TimedQuestionType): TimingStats | null {
    const typeResults = this.results.filter(r => r.questionType === questionType);
    
    if (typeResults.length < this.config.minSamples) {
      return null;
    }

    return this.calculateStats(questionType, typeResults);
  }

  /**
   * Get statistics for all question types
   */
  getAllStats(): Map<TimedQuestionType, TimingStats> {
    const statsByType = new Map<TimedQuestionType, TimingStats>();
    const questionTypes = new Set(this.results.map(r => r.questionType));

    for (const type of questionTypes) {
      const stats = this.getStatsByType(type);
      if (stats) {
        statsByType.set(type, stats);
      }
    }

    return statsByType;
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionResults: TimingResult[]): SessionTimingSummary {
    const totalQuestions = sessionResults.length;
    const totalTimeSeconds = sessionResults.reduce((sum, r) => sum + r.actualSeconds, 0);
    
    let fastCount = 0;
    let optimalCount = 0;
    let slowCount = 0;
    let overtimeCount = 0;

    for (const result of sessionResults) {
      switch (result.timingCategory) {
        case 'fast': fastCount++; break;
        case 'optimal': optimalCount++; break;
        case 'slow': slowCount++; break;
        case 'overtime': overtimeCount++; break;
      }
    }

    // Check for drift
    const driftAnalysis = this.detectDrift(sessionResults);

    // Stats by type
    const byQuestionType = new Map<TimedQuestionType, TimingStats>();
    const types = new Set(sessionResults.map(r => r.questionType));
    
    for (const type of types) {
      const typeResults = sessionResults.filter(r => r.questionType === type);
      if (typeResults.length >= 2) {
        byQuestionType.set(type, this.calculateStats(type, typeResults));
      }
    }

    return {
      totalQuestions,
      totalTimeSeconds,
      averageTimeSeconds: totalQuestions > 0 ? totalTimeSeconds / totalQuestions : 0,
      fastCount,
      optimalCount,
      slowCount,
      overtimeCount,
      driftDetected: driftAnalysis.detected,
      driftMagnitude: driftAnalysis.magnitude,
      byQuestionType
    };
  }

  /**
   * Detect timing drift (slowing down over session)
   */
  detectDrift(results: TimingResult[]): {
    detected: boolean;
    magnitude?: number;
    description?: string;
  } {
    if (results.length < this.config.driftWindow) {
      return { detected: false };
    }

    // Compare first half vs second half average time ratios
    const midpoint = Math.floor(results.length / 2);
    const firstHalf = results.slice(0, midpoint);
    const secondHalf = results.slice(midpoint);

    const firstHalfAvg = this.averageTimeRatio(firstHalf);
    const secondHalfAvg = this.averageTimeRatio(secondHalf);

    const driftMagnitude = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    if (driftMagnitude > this.config.driftThreshold) {
      return {
        detected: true,
        magnitude: driftMagnitude,
        description: `Time usage increased by ${Math.round(driftMagnitude * 100)}% in later questions`
      };
    }

    return { detected: false };
  }

  /**
   * Get pace recommendations
   */
  getPaceRecommendations(results: TimingResult[]): string[] {
    const recommendations: string[] = [];
    const summary = this.getSessionSummary(results);

    // Too many overtime
    if (summary.totalQuestions > 0) {
      const overtimePercent = (summary.overtimeCount / summary.totalQuestions) * 100;
      
      if (overtimePercent > 30) {
        recommendations.push(
          `${Math.round(overtimePercent)}% of questions went overtime. Practice time management techniques.`
        );
      }
    }

    // Drift detected
    if (summary.driftDetected) {
      recommendations.push(
        'Timing drift detected - you slow down as the session progresses. Take short mental breaks.'
      );
    }

    // Check specific question types
    for (const [type, stats] of summary.byQuestionType) {
      if (stats.percentOvertime > 40) {
        recommendations.push(
          `${type.replace(/-/g, ' ')} questions often go overtime (${Math.round(stats.percentOvertime)}%). Focus practice here.`
        );
      }
    }

    // Too fast (might indicate rushing)
    if (summary.fastCount > summary.totalQuestions * 0.5) {
      recommendations.push(
        'Many answers submitted very quickly. Ensure you are reading questions thoroughly.'
      );
    }

    return recommendations;
  }

  /**
   * Compare user timing to standard benchmarks
   */
  compareToBenchmark(questionType: TimedQuestionType): {
    userAverage: number;
    benchmark: number;
    percentDiff: number;
    assessment: 'faster' | 'on-pace' | 'slower';
  } | null {
    const stats = this.getStatsByType(questionType);
    if (!stats) return null;

    const benchmark = STANDARD_TIME_BUDGETS[questionType];
    const percentDiff = ((stats.meanSeconds - benchmark) / benchmark) * 100;

    let assessment: 'faster' | 'on-pace' | 'slower';
    if (percentDiff < -20) {
      assessment = 'faster';
    } else if (percentDiff > 20) {
      assessment = 'slower';
    } else {
      assessment = 'on-pace';
    }

    return {
      userAverage: stats.meanSeconds,
      benchmark,
      percentDiff,
      assessment
    };
  }

  /**
   * Calculate statistics for a set of results
   */
  private calculateStats(
    questionType: TimedQuestionType,
    results: TimingResult[]
  ): TimingStats {
    const times = results.map(r => r.actualSeconds).sort((a, b) => a - b);
    const n = times.length;

    // Mean
    const meanSeconds = times.reduce((sum, t) => sum + t, 0) / n;

    // Median
    const medianSeconds = n % 2 === 0
      ? (times[n / 2 - 1] + times[n / 2]) / 2
      : times[Math.floor(n / 2)];

    // Standard deviation
    const variance = times.reduce((sum, t) => sum + Math.pow(t - meanSeconds, 2), 0) / n;
    const stdDevSeconds = Math.sqrt(variance);

    // Category counts
    const categories = results.map(r => r.timingCategory);
    const fastCount = categories.filter(c => c === 'fast').length;
    const optimalCount = categories.filter(c => c === 'optimal').length;
    const slowCount = categories.filter(c => c === 'slow').length;
    const overtimeCount = categories.filter(c => c === 'overtime').length;

    return {
      questionType,
      sampleCount: n,
      meanSeconds,
      medianSeconds,
      stdDevSeconds,
      minSeconds: times[0],
      maxSeconds: times[n - 1],
      percentFast: (fastCount / n) * 100,
      percentOptimal: (optimalCount / n) * 100,
      percentSlow: (slowCount / n) * 100,
      percentOvertime: (overtimeCount / n) * 100
    };
  }

  /**
   * Calculate average time ratio for results
   */
  private averageTimeRatio(results: TimingResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.timeRatio, 0) / results.length;
  }
}
