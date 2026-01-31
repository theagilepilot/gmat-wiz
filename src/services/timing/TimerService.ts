/**
 * Timer Service
 * Manages timer state for question attempts
 */

import {
  TimerSession,
  TimerState,
  TimerWarning,
  TimeBudget,
  TimingResult,
  TimedQuestionType
} from './types';
import { BudgetCalculator } from './BudgetCalculator';

export class TimerService {
  private sessions: Map<string, TimerSession> = new Map();
  private budgetCalculator: BudgetCalculator;

  constructor() {
    this.budgetCalculator = new BudgetCalculator();
  }

  /**
   * Start a new timer session for a question
   */
  startSession(
    questionId: string,
    userId: string,
    questionType: TimedQuestionType,
    level: number,
    customMultiplier?: number
  ): TimerSession {
    const sessionId = this.generateSessionId();
    const budget = this.budgetCalculator.calculateBudget(
      questionType,
      level,
      customMultiplier
    );

    const session: TimerSession = {
      id: sessionId,
      questionId,
      userId,
      questionType,
      budget,
      state: 'running',
      startTime: new Date(),
      elapsedMs: 0,
      pausedMs: 0,
      warnings: []
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get current session state
   */
  getSession(sessionId: string): TimerSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Update elapsed time if running
    if (session.state === 'running' && session.startTime) {
      session.elapsedMs = Date.now() - session.startTime.getTime() - session.pausedMs;
    }

    return session;
  }

  /**
   * Pause a running session
   */
  pauseSession(sessionId: string): TimerSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'running') return undefined;

    session.state = 'paused';
    session.pauseTime = new Date();
    
    // Calculate elapsed time up to pause
    if (session.startTime) {
      session.elapsedMs = Date.now() - session.startTime.getTime() - session.pausedMs;
    }

    return session;
  }

  /**
   * Resume a paused session
   */
  resumeSession(sessionId: string): TimerSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'paused') return undefined;

    // Calculate time spent paused
    if (session.pauseTime) {
      session.pausedMs += Date.now() - session.pauseTime.getTime();
    }

    session.state = 'running';
    session.pauseTime = undefined;

    return session;
  }

  /**
   * Complete a session (user submitted answer)
   */
  completeSession(sessionId: string): TimingResult | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.state = 'completed';
    session.endTime = new Date();

    // Calculate final elapsed time
    if (session.startTime) {
      session.elapsedMs = session.endTime.getTime() - session.startTime.getTime() - session.pausedMs;
    }

    return this.createTimingResult(session);
  }

  /**
   * Expire a session (time ran out)
   */
  expireSession(sessionId: string): TimingResult | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.state = 'expired';
    session.endTime = new Date();

    // Set elapsed to budget (user ran out of time)
    session.elapsedMs = session.budget.adjustedSeconds * 1000;

    return this.createTimingResult(session);
  }

  /**
   * Check for warnings and add if needed
   */
  checkWarnings(sessionId: string): TimerWarning | undefined {
    const session = this.getSession(sessionId);
    if (!session || session.state !== 'running') return undefined;

    const percentUsed = (session.elapsedMs / 1000) / session.budget.adjustedSeconds;

    // Check if over time
    if (percentUsed >= 1.0) {
      const existingOvertime = session.warnings.find(w => w.type === 'over-time');
      if (!existingOvertime) {
        const warning: TimerWarning = {
          type: 'over-time',
          timestamp: new Date(),
          percentUsed: percentUsed * 100,
          message: session.budget.strictEnforcement
            ? 'Time has expired!'
            : 'You are over the time budget'
        };
        session.warnings.push(warning);
        return warning;
      }
      return undefined;
    }

    // Check if approaching limit
    if (percentUsed >= session.budget.warningThreshold) {
      const existingApproaching = session.warnings.find(w => w.type === 'approaching-limit');
      if (!existingApproaching) {
        const remainingSeconds = Math.round(
          session.budget.adjustedSeconds - (session.elapsedMs / 1000)
        );
        const warning: TimerWarning = {
          type: 'approaching-limit',
          timestamp: new Date(),
          percentUsed: percentUsed * 100,
          message: `${remainingSeconds} seconds remaining`
        };
        session.warnings.push(warning);
        return warning;
      }
    }

    return undefined;
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingSeconds(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (!session) return 0;

    const elapsedSeconds = session.elapsedMs / 1000;
    const remaining = session.budget.adjustedSeconds - elapsedSeconds;
    return Math.max(0, remaining);
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSeconds(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (!session) return 0;

    return session.elapsedMs / 1000;
  }

  /**
   * Get progress percentage (0-100+)
   */
  getProgressPercent(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (!session) return 0;

    return (session.elapsedMs / 1000 / session.budget.adjustedSeconds) * 100;
  }

  /**
   * Clean up old sessions
   */
  cleanupSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      const sessionAge = session.endTime 
        ? now - session.endTime.getTime()
        : session.startTime 
          ? now - session.startTime.getTime()
          : 0;

      if (sessionAge > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all active sessions for a user
   */
  getActiveSessions(userId: string): TimerSession[] {
    const active: TimerSession[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.userId === userId && 
          (session.state === 'running' || session.state === 'paused')) {
        active.push(this.getSession(session.id)!);
      }
    }

    return active;
  }

  /**
   * Create timing result from session
   */
  private createTimingResult(session: TimerSession): TimingResult {
    const actualSeconds = session.elapsedMs / 1000;
    const budgetSeconds = session.budget.adjustedSeconds;
    const timeRatio = actualSeconds / budgetSeconds;

    return {
      questionId: session.questionId,
      questionType: session.questionType,
      budgetSeconds,
      actualSeconds,
      timeRatio,
      wasOvertime: timeRatio > 1.0,
      percentUsed: timeRatio * 100,
      timingCategory: this.budgetCalculator.categorizeTimeUsage(actualSeconds, budgetSeconds)
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
