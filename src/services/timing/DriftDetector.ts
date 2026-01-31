/**
 * Drift Detector
 * Detects timing drift patterns (slowing down over time)
 */

import { TimingResult, TimedQuestionType } from './types';

/** Drift analysis result */
export interface DriftAnalysis {
  detected: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  magnitude: number;
  trend: 'stable' | 'increasing' | 'decreasing';
  description: string;
  recommendations: string[];
}

/** Window-based timing data */
interface TimingWindow {
  startIndex: number;
  endIndex: number;
  averageTimeRatio: number;
  averageSeconds: number;
}

export class DriftDetector {
  private windowSize: number;
  private mildThreshold: number;
  private moderateThreshold: number;
  private severeThreshold: number;

  constructor(
    windowSize: number = 5,
    mildThreshold: number = 0.15,
    moderateThreshold: number = 0.25,
    severeThreshold: number = 0.40
  ) {
    this.windowSize = windowSize;
    this.mildThreshold = mildThreshold;
    this.moderateThreshold = moderateThreshold;
    this.severeThreshold = severeThreshold;
  }

  /**
   * Analyze results for timing drift
   */
  analyze(results: TimingResult[]): DriftAnalysis {
    if (results.length < this.windowSize * 2) {
      return {
        detected: false,
        severity: 'none',
        magnitude: 0,
        trend: 'stable',
        description: 'Not enough data to detect drift',
        recommendations: []
      };
    }

    // Calculate sliding window averages
    const windows = this.calculateWindows(results);
    
    // Compare first and last windows
    const firstWindow = windows[0];
    const lastWindow = windows[windows.length - 1];
    
    const magnitude = (lastWindow.averageTimeRatio - firstWindow.averageTimeRatio) 
      / firstWindow.averageTimeRatio;

    // Determine severity
    let severity: 'none' | 'mild' | 'moderate' | 'severe';
    let detected = false;

    if (magnitude >= this.severeThreshold) {
      severity = 'severe';
      detected = true;
    } else if (magnitude >= this.moderateThreshold) {
      severity = 'moderate';
      detected = true;
    } else if (magnitude >= this.mildThreshold) {
      severity = 'mild';
      detected = true;
    } else {
      severity = 'none';
    }

    // Determine trend
    const trend = this.determineTrend(windows);

    // Generate description and recommendations
    const description = this.generateDescription(severity, magnitude, trend);
    const recommendations = this.generateRecommendations(severity, results);

    return {
      detected,
      severity,
      magnitude,
      trend,
      description,
      recommendations
    };
  }

  /**
   * Analyze drift by question type
   */
  analyzeByType(results: TimingResult[]): Map<TimedQuestionType, DriftAnalysis> {
    const byType = new Map<TimedQuestionType, DriftAnalysis>();
    const types = new Set(results.map(r => r.questionType));

    for (const type of types) {
      const typeResults = results.filter(r => r.questionType === type);
      if (typeResults.length >= this.windowSize * 2) {
        byType.set(type, this.analyze(typeResults));
      }
    }

    return byType;
  }

  /**
   * Get real-time drift warning during session
   */
  checkRealTimeDrift(
    recentResults: TimingResult[],
    sessionAverage: number
  ): { warning: boolean; message?: string } {
    if (recentResults.length < 3) {
      return { warning: false };
    }

    // Check last 3 questions
    const recent = recentResults.slice(-3);
    const recentAvg = recent.reduce((sum, r) => sum + r.timeRatio, 0) / 3;

    // If recent average is 30%+ higher than session average, warn
    if (recentAvg > sessionAverage * 1.3) {
      return {
        warning: true,
        message: `Your recent pace has slowed. Try to maintain your earlier rhythm.`
      };
    }

    return { warning: false };
  }

  /**
   * Calculate sliding windows of timing data
   */
  private calculateWindows(results: TimingResult[]): TimingWindow[] {
    const windows: TimingWindow[] = [];
    
    for (let i = 0; i <= results.length - this.windowSize; i++) {
      const windowResults = results.slice(i, i + this.windowSize);
      const avgRatio = windowResults.reduce((sum, r) => sum + r.timeRatio, 0) / this.windowSize;
      const avgSeconds = windowResults.reduce((sum, r) => sum + r.actualSeconds, 0) / this.windowSize;

      windows.push({
        startIndex: i,
        endIndex: i + this.windowSize - 1,
        averageTimeRatio: avgRatio,
        averageSeconds: avgSeconds
      });
    }

    return windows;
  }

  /**
   * Determine overall trend from windows
   */
  private determineTrend(windows: TimingWindow[]): 'stable' | 'increasing' | 'decreasing' {
    if (windows.length < 2) return 'stable';

    // Count increasing vs decreasing transitions
    let increases = 0;
    let decreases = 0;

    for (let i = 1; i < windows.length; i++) {
      const diff = windows[i].averageTimeRatio - windows[i - 1].averageTimeRatio;
      if (diff > 0.05) increases++;
      if (diff < -0.05) decreases++;
    }

    if (increases > decreases * 1.5) return 'increasing';
    if (decreases > increases * 1.5) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    severity: 'none' | 'mild' | 'moderate' | 'severe',
    magnitude: number,
    trend: 'stable' | 'increasing' | 'decreasing'
  ): string {
    if (severity === 'none') {
      return 'Your pacing is consistent throughout the session.';
    }

    const percentIncrease = Math.round(magnitude * 100);
    
    switch (severity) {
      case 'mild':
        return `Slight timing drift detected. Time per question increased by ~${percentIncrease}% toward the end.`;
      case 'moderate':
        return `Noticeable timing drift. You spent ${percentIncrease}% more time on later questions.`;
      case 'severe':
        return `Significant timing drift. Later questions took ${percentIncrease}% longer than early ones.`;
    }
  }

  /**
   * Generate recommendations based on drift
   */
  private generateRecommendations(
    severity: 'none' | 'mild' | 'moderate' | 'severe',
    results: TimingResult[]
  ): string[] {
    if (severity === 'none') return [];

    const recommendations: string[] = [];

    // Generic recommendations
    recommendations.push('Take a brief mental break every 10-15 questions');
    
    if (severity === 'moderate' || severity === 'severe') {
      recommendations.push('Practice with the full number of questions to build endurance');
      recommendations.push('Check if fatigue or loss of focus is causing the slowdown');
    }

    // Check for overtime pattern in later questions
    const midpoint = Math.floor(results.length / 2);
    const laterResults = results.slice(midpoint);
    const overtimeRate = laterResults.filter(r => r.wasOvertime).length / laterResults.length;

    if (overtimeRate > 0.3) {
      recommendations.push('Consider strategic guessing on difficult later questions to maintain pace');
    }

    return recommendations;
  }
}
