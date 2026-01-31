/**
 * User Progress Service
 * Business logic for user progress tracking and gamification
 */

import {
  getUserProfile,
  updateUserProfile,
  getUserSettings,
  updateUserSettings,
  addXP,
  incrementQuestionsAttempted,
  updateStudyStreak,
  levelUp,
  createStudySession,
  endStudySession,
  getTotalStudyMinutesToday,
  getRecentSessions,
  type UserProfile,
  type UserSettings,
  type StudySession,
} from '../models/UserProgress.js';

// ============================================
// Types
// ============================================

export interface DailyProgress {
  minutesStudied: number;
  goalMinutes: number;
  percentComplete: number;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  xpEarned: number;
  streakDays: number;
}

export interface OverallProgress {
  currentLevel: number;
  levelName: string;
  totalXP: number;
  xpToNextLevel: number;
  xpProgress: number;
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  overallAccuracy: number;
  totalStudyMinutes: number;
  streakDays: number;
}

export interface LevelInfo {
  level: number;
  name: string;
  description: string;
  xpRequired: number;
}

// ============================================
// Constants
// ============================================

export const LEVELS: LevelInfo[] = [
  { level: 1, name: 'Orientation', description: 'Understand GMAT structure and mechanics', xpRequired: 0 },
  { level: 2, name: 'Foundations', description: 'Rebuild core math, grammar, and argument fundamentals', xpRequired: 500 },
  { level: 3, name: 'Recognition', description: 'Instantly identify question types and common traps', xpRequired: 1500 },
  { level: 4, name: 'Easy Mastery', description: 'Answer easy questions quickly and accurately', xpRequired: 3000 },
  { level: 5, name: 'Medium Control', description: 'Solve medium questions consistently with timing', xpRequired: 5000 },
  { level: 6, name: 'Strategy & Abandonment', description: 'Select fastest approach, guess strategically', xpRequired: 8000 },
  { level: 7, name: 'Hard Exposure', description: 'Maintain composure on hard questions', xpRequired: 12000 },
  { level: 8, name: 'Consistency', description: 'Stable performance across full sections', xpRequired: 17000 },
  { level: 9, name: 'Elite Execution', description: 'Score reliably in the 750-800 range', xpRequired: 23000 },
  { level: 10, name: 'Test-Day Operator', description: 'Execute calmly with no learning, only performance', xpRequired: 30000 },
];

// XP awards for different actions
export const XP_AWARDS = {
  CORRECT_ANSWER: 10,
  CORRECT_FAST: 15,  // Under time budget
  CORRECT_CLEAN: 20, // Clean win (fast + no hints)
  HINT_PENALTY: -3,
  STREAK_BONUS_PER_DAY: 5, // Bonus XP per streak day (max 50)
  PROVE_MODE_MULTIPLIER: 1.5,
  LEVEL_COMPLETION_BONUS: 100,
};

// ============================================
// Service Functions
// ============================================

export function getProfile(): UserProfile {
  return getUserProfile();
}

export function getSettings(): UserSettings {
  return getUserSettings();
}

export function updateSettings(updates: Partial<Omit<UserSettings, 'id' | 'updated_at'>>): UserSettings {
  return updateUserSettings(updates);
}

export function getLevelInfo(level: number): LevelInfo {
  return LEVELS[level - 1] ?? LEVELS[0]!;
}

export function getCurrentLevelInfo(): LevelInfo {
  const profile = getUserProfile();
  return getLevelInfo(profile.current_level);
}

export function getNextLevelInfo(): LevelInfo | null {
  const profile = getUserProfile();
  if (profile.current_level >= 10) return null;
  return getLevelInfo(profile.current_level + 1);
}

export function calculateXPToNextLevel(): { current: number; required: number; progress: number } {
  const profile = getUserProfile();
  const currentLevelInfo = getLevelInfo(profile.current_level);
  const nextLevelInfo = getNextLevelInfo();
  
  if (!nextLevelInfo) {
    return { current: profile.total_xp, required: profile.total_xp, progress: 100 };
  }
  
  const xpInCurrentLevel = profile.total_xp - currentLevelInfo.xpRequired;
  const xpRequiredForNext = nextLevelInfo.xpRequired - currentLevelInfo.xpRequired;
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForNext) * 100));
  
  return {
    current: xpInCurrentLevel,
    required: xpRequiredForNext,
    progress,
  };
}

export function getDailyProgress(): DailyProgress {
  const profile = getUserProfile();
  const settings = getUserSettings();
  const minutesStudied = getTotalStudyMinutesToday();
  
  // Get today's stats from recent sessions
  const todaySessions = getRecentSessions(50).filter(s => {
    const sessionDate = new Date(s.started_at).toDateString();
    return sessionDate === new Date().toDateString();
  });
  
  const questionsAttempted = todaySessions.reduce((sum, s) => sum + s.questions_attempted, 0);
  const questionsCorrect = todaySessions.reduce((sum, s) => sum + s.questions_correct, 0);
  const xpEarned = todaySessions.reduce((sum, s) => sum + s.xp_earned, 0);
  
  return {
    minutesStudied,
    goalMinutes: settings.daily_goal_minutes,
    percentComplete: Math.min(100, Math.round((minutesStudied / settings.daily_goal_minutes) * 100)),
    questionsAttempted,
    questionsCorrect,
    accuracy: questionsAttempted > 0 ? Math.round((questionsCorrect / questionsAttempted) * 100) : 0,
    xpEarned,
    streakDays: profile.study_streak_days,
  };
}

export function getOverallProgress(): OverallProgress {
  const profile = getUserProfile();
  const levelInfo = getCurrentLevelInfo();
  const xpInfo = calculateXPToNextLevel();
  
  return {
    currentLevel: profile.current_level,
    levelName: levelInfo.name,
    totalXP: profile.total_xp,
    xpToNextLevel: xpInfo.required - xpInfo.current,
    xpProgress: xpInfo.progress,
    totalQuestionsAttempted: profile.total_questions_attempted,
    totalQuestionsCorrect: profile.total_questions_correct,
    overallAccuracy: profile.total_questions_attempted > 0
      ? Math.round((profile.total_questions_correct / profile.total_questions_attempted) * 100)
      : 0,
    totalStudyMinutes: profile.total_study_minutes,
    streakDays: profile.study_streak_days,
  };
}

export function awardXP(
  baseAmount: number,
  options: {
    isProveMode?: boolean;
    includeStreakBonus?: boolean;
  } = {}
): { xpAwarded: number; newTotal: number; leveledUp: boolean } {
  const profile = getUserProfile();
  let amount = baseAmount;
  
  // Apply prove mode multiplier
  if (options.isProveMode) {
    amount = Math.round(amount * XP_AWARDS.PROVE_MODE_MULTIPLIER);
  }
  
  // Apply streak bonus
  if (options.includeStreakBonus && profile.study_streak_days > 0) {
    const streakBonus = Math.min(50, profile.study_streak_days * XP_AWARDS.STREAK_BONUS_PER_DAY);
    amount += streakBonus;
  }
  
  // Add XP
  const updated = addXP(amount);
  
  // Check for level up
  let leveledUp = false;
  const nextLevel = getNextLevelInfo();
  if (nextLevel && updated.total_xp >= nextLevel.xpRequired) {
    levelUp();
    leveledUp = true;
  }
  
  return {
    xpAwarded: amount,
    newTotal: updated.total_xp,
    leveledUp,
  };
}

export function recordQuestionAttempt(
  correct: boolean,
  options: {
    wasCleanWin?: boolean;
    wasFast?: boolean;
    usedHint?: boolean;
    isProveMode?: boolean;
  } = {}
): { xpAwarded: number; newTotal: number; leveledUp: boolean } {
  // Update question stats
  incrementQuestionsAttempted(correct);
  updateStudyStreak();
  
  // Calculate XP
  let xp = 0;
  if (correct) {
    if (options.wasCleanWin) {
      xp = XP_AWARDS.CORRECT_CLEAN;
    } else if (options.wasFast) {
      xp = XP_AWARDS.CORRECT_FAST;
    } else {
      xp = XP_AWARDS.CORRECT_ANSWER;
    }
  }
  
  if (options.usedHint) {
    xp += XP_AWARDS.HINT_PENALTY;
  }
  
  // Award XP
  return awardXP(Math.max(0, xp), {
    isProveMode: options.isProveMode,
    includeStreakBonus: false, // Only on session end
  });
}

export function startSession(mode: 'build' | 'prove'): StudySession {
  const profile = getUserProfile();
  updateStudyStreak();
  
  return createStudySession({
    mode,
    level_at_start: profile.current_level,
  });
}

export function finishSession(sessionId: number, xpEarned: number): StudySession | null {
  const session = endStudySession(sessionId);
  if (!session) return null;
  
  // Update total study minutes
  const profile = getUserProfile();
  updateUserProfile({
    total_study_minutes: profile.total_study_minutes + (session.duration_minutes ?? 0),
  });
  
  return session;
}

export function checkLevelUpEligibility(): {
  eligible: boolean;
  currentLevel: number;
  nextLevel: number | null;
  xpNeeded: number;
  blockedByGates: boolean;
} {
  const profile = getUserProfile();
  const nextLevel = getNextLevelInfo();
  
  if (!nextLevel) {
    return {
      eligible: false,
      currentLevel: profile.current_level,
      nextLevel: null,
      xpNeeded: 0,
      blockedByGates: false,
    };
  }
  
  const xpNeeded = Math.max(0, nextLevel.xpRequired - profile.total_xp);
  const hasEnoughXP = xpNeeded === 0;
  
  // TODO: Check mastery gates (will be implemented in Phase 6)
  const blockedByGates = false;
  
  return {
    eligible: hasEnoughXP && !blockedByGates,
    currentLevel: profile.current_level,
    nextLevel: nextLevel.level,
    xpNeeded,
    blockedByGates,
  };
}
