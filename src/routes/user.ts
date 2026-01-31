/**
 * User API Routes
 * User profile, settings, and progress endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getProfile,
  getSettings,
  updateSettings,
  getDailyProgress,
  getOverallProgress,
  getCurrentLevelInfo,
  getNextLevelInfo,
  calculateXPToNextLevel,
  awardXP,
  startSession,
  finishSession,
  LEVELS,
} from '../services/UserProgressService.js';
import {
  getRecentSessions,
  updateStudyStreak,
} from '../models/UserProgress.js';

export const userRouter = Router();

// ============================================
// GET /api/user/profile
// Get current user profile with level info
// ============================================
userRouter.get('/profile', (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = getProfile();
    const levelInfo = getCurrentLevelInfo();
    const nextLevel = getNextLevelInfo();
    const xpProgress = calculateXPToNextLevel();

    res.json({
      success: true,
      data: {
        level: profile.current_level,
        levelName: levelInfo.name,
        levelDescription: levelInfo.description,
        totalXP: profile.total_xp,
        xpProgress: {
          current: xpProgress.current,
          required: xpProgress.required,
          percentage: xpProgress.progress,
        },
        nextLevel: nextLevel ? {
          level: nextLevel.level,
          name: nextLevel.name,
          xpRequired: nextLevel.xpRequired,
        } : null,
        streakDays: profile.study_streak_days,
        lastStudyDate: profile.last_study_date,
        totalStudyMinutes: profile.total_study_minutes,
        totalQuestionsAttempted: profile.total_questions_attempted,
        totalQuestionsCorrect: profile.total_questions_correct,
        accuracy: profile.total_questions_attempted > 0
          ? Math.round((profile.total_questions_correct / profile.total_questions_attempted) * 100)
          : 0,
        memberSince: profile.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/user/settings
// Get user settings
// ============================================
userRouter.get('/settings', (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = getSettings();

    res.json({
      success: true,
      data: {
        dailyGoalMinutes: settings.daily_goal_minutes,
        hintsEnabled: settings.hints_enabled,
        soundEnabled: settings.sound_enabled,
        darkMode: settings.dark_mode,
        keyboardShortcuts: settings.keyboard_shortcuts,
        preferredSections: settings.preferred_sections,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /api/user/settings
// Update user settings
// ============================================
userRouter.put('/settings', (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      dailyGoalMinutes,
      hintsEnabled,
      soundEnabled,
      darkMode,
      keyboardShortcuts,
      preferredSections,
    } = req.body;

    const updates: Record<string, unknown> = {};
    if (dailyGoalMinutes !== undefined) updates.daily_goal_minutes = dailyGoalMinutes;
    if (hintsEnabled !== undefined) updates.hints_enabled = hintsEnabled;
    if (soundEnabled !== undefined) updates.sound_enabled = soundEnabled;
    if (darkMode !== undefined) updates.dark_mode = darkMode;
    if (keyboardShortcuts !== undefined) updates.keyboard_shortcuts = keyboardShortcuts;
    if (preferredSections !== undefined) updates.preferred_sections = preferredSections;

    const settings = updateSettings(updates);

    res.json({
      success: true,
      data: {
        dailyGoalMinutes: settings.daily_goal_minutes,
        hintsEnabled: settings.hints_enabled,
        soundEnabled: settings.sound_enabled,
        darkMode: settings.dark_mode,
        keyboardShortcuts: settings.keyboard_shortcuts,
        preferredSections: settings.preferred_sections,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/user/progress
// Get detailed progress information
// ============================================
userRouter.get('/progress', (req: Request, res: Response, next: NextFunction) => {
  try {
    const daily = getDailyProgress();
    const overall = getOverallProgress();

    res.json({
      success: true,
      data: {
        daily: {
          minutesStudied: daily.minutesStudied,
          goalMinutes: daily.goalMinutes,
          percentComplete: daily.percentComplete,
          questionsAttempted: daily.questionsAttempted,
          questionsCorrect: daily.questionsCorrect,
          accuracy: daily.accuracy,
          xpEarned: daily.xpEarned,
        },
        overall: {
          level: overall.currentLevel,
          levelName: overall.levelName,
          totalXP: overall.totalXP,
          xpToNextLevel: overall.xpToNextLevel,
          xpProgress: overall.xpProgress,
          totalQuestions: overall.totalQuestionsAttempted,
          totalCorrect: overall.totalQuestionsCorrect,
          accuracy: overall.overallAccuracy,
          totalMinutes: overall.totalStudyMinutes,
          streakDays: overall.streakDays,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/user/stats
// Get aggregate statistics
// ============================================
userRouter.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = getProfile();
    const recentSessions = getRecentSessions(30);

    // Calculate recent stats (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentSessionsFiltered = recentSessions.filter(
      s => new Date(s.started_at) >= sevenDaysAgo
    );

    const recentQuestions = recentSessionsFiltered.reduce((sum, s) => sum + s.questions_attempted, 0);
    const recentCorrect = recentSessionsFiltered.reduce((sum, s) => sum + s.questions_correct, 0);
    const recentMinutes = recentSessionsFiltered.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

    res.json({
      success: true,
      data: {
        allTime: {
          totalSessions: recentSessions.length,
          totalQuestions: profile.total_questions_attempted,
          totalCorrect: profile.total_questions_correct,
          accuracy: profile.total_questions_attempted > 0
            ? Math.round((profile.total_questions_correct / profile.total_questions_attempted) * 100)
            : 0,
          totalMinutes: profile.total_study_minutes,
          streakDays: profile.study_streak_days,
        },
        last7Days: {
          sessions: recentSessionsFiltered.length,
          questions: recentQuestions,
          correct: recentCorrect,
          accuracy: recentQuestions > 0 ? Math.round((recentCorrect / recentQuestions) * 100) : 0,
          minutes: recentMinutes,
        },
        levels: LEVELS.map(l => ({
          level: l.level,
          name: l.name,
          description: l.description,
          xpRequired: l.xpRequired,
          isUnlocked: profile.total_xp >= l.xpRequired,
          isCurrent: profile.current_level === l.level,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/user/session/start
// Start a new study session
// ============================================
userRouter.post('/session/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mode = 'build' } = req.body;
    
    // Update streak when starting a session
    updateStudyStreak();
    
    const session = startSession(mode);

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        mode: session.mode,
        startedAt: session.started_at,
        levelAtStart: session.level_at_start,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/user/session/:id/end
// End a study session
// ============================================
userRouter.post('/session/:id/end', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(req.params.id as string, 10);
    const { xpEarned = 0 } = req.body;

    const session = finishSession(sessionId, xpEarned);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        duration: session.duration_minutes,
        questionsAttempted: session.questions_attempted,
        questionsCorrect: session.questions_correct,
        accuracy: session.questions_attempted > 0
          ? Math.round((session.questions_correct / session.questions_attempted) * 100)
          : 0,
        xpEarned: session.xp_earned,
      },
    });
  } catch (error) {
    next(error);
  }
});
