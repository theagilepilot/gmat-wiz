/**
 * Dashboard API Routes
 * Analytics, readiness scores, and performance insights
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getProfile } from '../services/UserProgressService.js';
import { getRecentSessions } from '../models/UserProgress.js';
import { getRecentAttempts, getAttemptsBySession } from '../models/Question.js';
import { getGlobalRating, getSectionRating, getMasteryStats } from '../models/EloRating.js';
import { getRecentErrorLogs, getErrorLogsByType, getAllErrorTypes } from '../models/ErrorLog.js';

export const dashboardRouter = Router();

// ============================================
// GET /api/dashboard/readiness
// Get overall test readiness score
// ============================================
dashboardRouter.get('/readiness', (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = getProfile();
    const globalRating = getGlobalRating();
    const quantRating = getSectionRating('quant');
    const verbalRating = getSectionRating('verbal');

    // Calculate readiness based on multiple factors
    const factors: { name: string; score: number; weight: number; detail: string }[] = [];

    // ELO Rating (target: 650+ for 700+ GMAT)
    const eloScore = globalRating 
      ? Math.min(100, Math.round((globalRating.rating / 700) * 100))
      : 50;
    factors.push({
      name: 'Skill Level',
      score: eloScore,
      weight: 0.3,
      detail: `Current ELO: ${globalRating?.rating ?? 500}`,
    });

    // Consistency (based on rating deviation)
    const consistencyScore = globalRating
      ? Math.min(100, Math.round((1 - globalRating.rating_deviation / 350) * 100))
      : 20;
    factors.push({
      name: 'Consistency',
      score: consistencyScore,
      weight: 0.2,
      detail: `Rating deviation: ${globalRating?.rating_deviation ?? 350}`,
    });

    // Accuracy
    const accuracy = profile.total_questions_attempted > 0
      ? (profile.total_questions_correct / profile.total_questions_attempted) * 100
      : 0;
    factors.push({
      name: 'Accuracy',
      score: Math.round(accuracy),
      weight: 0.2,
      detail: `${Math.round(accuracy)}% overall`,
    });

    // Volume (practice makes perfect)
    const volumeScore = Math.min(100, Math.round(profile.total_questions_attempted / 5));
    factors.push({
      name: 'Practice Volume',
      score: volumeScore,
      weight: 0.15,
      detail: `${profile.total_questions_attempted} questions attempted`,
    });

    // Streak (momentum)
    const streakScore = Math.min(100, profile.study_streak_days * 10);
    factors.push({
      name: 'Study Momentum',
      score: streakScore,
      weight: 0.15,
      detail: `${profile.study_streak_days} day streak`,
    });

    // Calculate weighted readiness
    const overallReadiness = Math.round(
      factors.reduce((sum, f) => sum + f.score * f.weight, 0)
    );

    // Estimate GMAT score range
    const estimatedLow = Math.round(400 + (overallReadiness / 100) * 400);
    const estimatedHigh = Math.min(800, estimatedLow + 50);

    res.json({
      success: true,
      data: {
        overallReadiness,
        estimatedScoreRange: {
          low: estimatedLow,
          high: estimatedHigh,
        },
        factors,
        sectionReadiness: {
          quant: quantRating ? Math.min(100, Math.round((quantRating.rating / 700) * 100)) : 50,
          verbal: verbalRating ? Math.min(100, Math.round((verbalRating.rating / 700) * 100)) : 50,
        },
        recommendation: overallReadiness < 50
          ? 'Focus on building fundamentals and consistent practice'
          : overallReadiness < 70
          ? 'Good progress! Work on weak areas and increase difficulty'
          : overallReadiness < 85
          ? 'Strong foundation. Focus on timing and hard questions'
          : 'Excellent! Fine-tune with timed practice tests',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/dashboard/weakness-heatmap
// Get weakness data by topic/atom
// ============================================
dashboardRouter.get('/weakness-heatmap', (req: Request, res: Response, next: NextFunction) => {
  try {
    const recentAttempts = getRecentAttempts(200);
    
    // Group by section and calculate accuracy
    const sectionStats: Record<string, { total: number; correct: number; avgTime: number }> = {};
    
    // This would ideally join with questions to get section info
    // For now, return a simplified structure
    const weaknesses: { area: string; accuracy: number; attempts: number; priority: string }[] = [];

    // Calculate overall recent performance
    const totalAttempts = recentAttempts.length;
    const correctAttempts = recentAttempts.filter(a => a.is_correct).length;
    const overallAccuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    // Identify timing issues
    const overtimeAttempts = recentAttempts.filter(a => a.was_overtime);
    if (overtimeAttempts.length > totalAttempts * 0.2) {
      weaknesses.push({
        area: 'Time Management',
        accuracy: Math.round((1 - overtimeAttempts.length / totalAttempts) * 100),
        attempts: totalAttempts,
        priority: 'high',
      });
    }

    // Identify guessing issues
    const guessedAttempts = recentAttempts.filter(a => a.was_guessed);
    if (guessedAttempts.length > totalAttempts * 0.1) {
      weaknesses.push({
        area: 'Confidence/Guessing',
        accuracy: Math.round((1 - guessedAttempts.length / totalAttempts) * 100),
        attempts: totalAttempts,
        priority: 'medium',
      });
    }

    res.json({
      success: true,
      data: {
        totalAttempts,
        overallAccuracy: Math.round(overallAccuracy),
        weaknesses,
        recommendation: weaknesses.length > 0
          ? `Focus on: ${weaknesses[0].area}`
          : 'Keep practicing to identify weakness areas',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/dashboard/timing-report
// Get timing statistics and drift analysis
// ============================================
dashboardRouter.get('/timing-report', (req: Request, res: Response, next: NextFunction) => {
  try {
    const recentAttempts = getRecentAttempts(100);

    if (recentAttempts.length === 0) {
      res.json({
        success: true,
        data: {
          totalAttempts: 0,
          avgTimeSeconds: 0,
          overtimeRate: 0,
          message: 'No attempts yet to analyze',
        },
      });
      return;
    }

    // Calculate timing stats
    const totalTime = recentAttempts.reduce((sum, a) => sum + a.time_taken_seconds, 0);
    const avgTime = totalTime / recentAttempts.length;
    const overtimeCount = recentAttempts.filter(a => a.was_overtime).length;
    const overtimeRate = (overtimeCount / recentAttempts.length) * 100;

    // Calculate timing trend (compare first half to second half)
    const midpoint = Math.floor(recentAttempts.length / 2);
    const firstHalf = recentAttempts.slice(0, midpoint);
    const secondHalf = recentAttempts.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, a) => sum + a.time_taken_seconds, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, a) => sum + a.time_taken_seconds, 0) / secondHalf.length;

    const timingTrend = secondHalfAvg < firstHalfAvg ? 'improving' : 
                        secondHalfAvg > firstHalfAvg * 1.1 ? 'slowing' : 'stable';

    // Time distribution
    const fast = recentAttempts.filter(a => a.time_taken_seconds < 60).length;
    const normal = recentAttempts.filter(a => a.time_taken_seconds >= 60 && a.time_taken_seconds <= 120).length;
    const slow = recentAttempts.filter(a => a.time_taken_seconds > 120 && !a.was_overtime).length;

    res.json({
      success: true,
      data: {
        totalAttempts: recentAttempts.length,
        avgTimeSeconds: Math.round(avgTime),
        overtimeRate: Math.round(overtimeRate),
        overtimeCount,
        timingTrend,
        distribution: {
          fast: Math.round((fast / recentAttempts.length) * 100),
          normal: Math.round((normal / recentAttempts.length) * 100),
          slow: Math.round((slow / recentAttempts.length) * 100),
          overtime: Math.round(overtimeRate),
        },
        recommendation: overtimeRate > 20
          ? 'Work on pacing - too many overtime attempts'
          : timingTrend === 'slowing'
          ? 'Watch for fatigue - times are increasing'
          : 'Good timing discipline!',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/dashboard/error-trends
// Get error type trends over time
// ============================================
dashboardRouter.get('/error-trends', (req: Request, res: Response, next: NextFunction) => {
  try {
    const recentErrors = getRecentErrorLogs(100);
    const errorTypes = getAllErrorTypes();

    // Count by error type
    const errorCounts: Record<string, number> = {};
    for (const error of recentErrors) {
      errorCounts[error.error_type_code] = (errorCounts[error.error_type_code] || 0) + 1;
    }

    // Sort by count
    const sortedErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Get error type names
    const topErrors = sortedErrors.map(([code, count]) => {
      const errorType = errorTypes.find(et => et.code === code);
      return {
        code,
        name: errorType?.name ?? code,
        category: errorType?.category ?? 'unknown',
        count,
        percentage: Math.round((count / recentErrors.length) * 100),
      };
    });

    // Count unresolved
    const unresolvedCount = recentErrors.filter(e => !e.is_resolved).length;

    res.json({
      success: true,
      data: {
        totalErrors: recentErrors.length,
        unresolvedCount,
        topErrors,
        mostCommonCategory: topErrors[0]?.category ?? 'none',
        recommendation: topErrors.length > 0
          ? `Focus on reducing ${topErrors[0].name} errors`
          : 'Keep logging errors for better insights',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/dashboard/recent-activity
// Get recent activity summary
// ============================================
dashboardRouter.get('/recent-activity', (req: Request, res: Response, next: NextFunction) => {
  try {
    const recentSessions = getRecentSessions(10);
    const recentAttempts = getRecentAttempts(20);

    res.json({
      success: true,
      data: {
        recentSessions: recentSessions.map(s => ({
          id: s.id,
          mode: s.mode,
          startedAt: s.started_at,
          duration: s.duration_minutes,
          questions: s.questions_attempted,
          correct: s.questions_correct,
          xp: s.xp_earned,
        })),
        recentAttempts: recentAttempts.map(a => ({
          id: a.id,
          questionId: a.question_id,
          isCorrect: a.is_correct,
          timeTaken: a.time_taken_seconds,
          wasOvertime: a.was_overtime,
          createdAt: a.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
