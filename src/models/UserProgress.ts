/**
 * User Progress Model
 * Tracks user profile, settings, and study progress
 */

import { getDatabase, execute, query, queryOne, saveDatabase } from '../db/connection.js';

// ============================================
// Types
// ============================================

export interface UserProfile {
  id: number;
  created_at: string;
  updated_at: string;
  current_level: number;
  total_xp: number;
  study_streak_days: number;
  last_study_date: string | null;
  total_study_minutes: number;
  total_questions_attempted: number;
  total_questions_correct: number;
}

export interface UserSettings {
  id: number;
  daily_goal_minutes: number;
  hints_enabled: boolean;
  sound_enabled: boolean;
  dark_mode: boolean;
  keyboard_shortcuts: boolean;
  preferred_sections: string[];
  updated_at: string;
}

export interface StudySession {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  questions_attempted: number;
  questions_correct: number;
  xp_earned: number;
  mode: 'build' | 'prove';
  level_at_start: number;
  notes: string | null;
}

export interface CreateSessionInput {
  mode: 'build' | 'prove';
  level_at_start: number;
}

export interface UpdateSessionInput {
  ended_at?: string;
  duration_minutes?: number;
  questions_attempted?: number;
  questions_correct?: number;
  xp_earned?: number;
  notes?: string;
}

// ============================================
// User Profile Functions
// ============================================

export function getUserProfile(): UserProfile {
  const row = queryOne<UserProfile>('SELECT * FROM user_profile WHERE id = 1');
  if (!row) {
    throw new Error('User profile not found');
  }
  return row;
}

export function updateUserProfile(updates: Partial<Omit<UserProfile, 'id' | 'created_at'>>): UserProfile {
  const profile = getUserProfile();
  const db = getDatabase();
  
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (updates.current_level !== undefined) {
    fields.push('current_level = ?');
    values.push(updates.current_level);
  }
  if (updates.total_xp !== undefined) {
    fields.push('total_xp = ?');
    values.push(updates.total_xp);
  }
  if (updates.study_streak_days !== undefined) {
    fields.push('study_streak_days = ?');
    values.push(updates.study_streak_days);
  }
  if (updates.last_study_date !== undefined) {
    fields.push('last_study_date = ?');
    values.push(updates.last_study_date);
  }
  if (updates.total_study_minutes !== undefined) {
    fields.push('total_study_minutes = ?');
    values.push(updates.total_study_minutes);
  }
  if (updates.total_questions_attempted !== undefined) {
    fields.push('total_questions_attempted = ?');
    values.push(updates.total_questions_attempted);
  }
  if (updates.total_questions_correct !== undefined) {
    fields.push('total_questions_correct = ?');
    values.push(updates.total_questions_correct);
  }
  
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    const sql = `UPDATE user_profile SET ${fields.join(', ')} WHERE id = 1`;
    db.run(sql, values);
    saveDatabase();
  }
  
  return getUserProfile();
}

export function addXP(amount: number): UserProfile {
  const profile = getUserProfile();
  return updateUserProfile({
    total_xp: profile.total_xp + amount,
  });
}

export function incrementQuestionsAttempted(correct: boolean): UserProfile {
  const profile = getUserProfile();
  return updateUserProfile({
    total_questions_attempted: profile.total_questions_attempted + 1,
    total_questions_correct: profile.total_questions_correct + (correct ? 1 : 0),
  });
}

export function updateStudyStreak(): UserProfile {
  const profile = getUserProfile();
  const today = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
  
  let newStreak = profile.study_streak_days;
  
  if (profile.last_study_date === today) {
    // Already studied today, no change
  } else if (profile.last_study_date === yesterday) {
    // Continuing streak
    newStreak = profile.study_streak_days + 1;
  } else {
    // Streak broken or first day
    newStreak = 1;
  }
  
  return updateUserProfile({
    study_streak_days: newStreak,
    last_study_date: today,
  });
}

export function levelUp(): UserProfile {
  const profile = getUserProfile();
  if (profile.current_level < 10) {
    return updateUserProfile({
      current_level: profile.current_level + 1,
    });
  }
  return profile;
}

// ============================================
// User Settings Functions
// ============================================

export function getUserSettings(): UserSettings {
  const row = queryOne<{
    id: number;
    daily_goal_minutes: number;
    hints_enabled: number;
    sound_enabled: number;
    dark_mode: number;
    keyboard_shortcuts: number;
    preferred_sections: string;
    updated_at: string;
  }>('SELECT * FROM user_settings WHERE id = 1');
  
  if (!row) {
    throw new Error('User settings not found');
  }
  
  return {
    id: row.id,
    daily_goal_minutes: row.daily_goal_minutes,
    hints_enabled: row.hints_enabled === 1,
    sound_enabled: row.sound_enabled === 1,
    dark_mode: row.dark_mode === 1,
    keyboard_shortcuts: row.keyboard_shortcuts === 1,
    preferred_sections: JSON.parse(row.preferred_sections) as string[],
    updated_at: row.updated_at,
  };
}

export function updateUserSettings(updates: Partial<Omit<UserSettings, 'id' | 'updated_at'>>): UserSettings {
  const db = getDatabase();
  
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (updates.daily_goal_minutes !== undefined) {
    fields.push('daily_goal_minutes = ?');
    values.push(updates.daily_goal_minutes);
  }
  if (updates.hints_enabled !== undefined) {
    fields.push('hints_enabled = ?');
    values.push(updates.hints_enabled ? 1 : 0);
  }
  if (updates.sound_enabled !== undefined) {
    fields.push('sound_enabled = ?');
    values.push(updates.sound_enabled ? 1 : 0);
  }
  if (updates.dark_mode !== undefined) {
    fields.push('dark_mode = ?');
    values.push(updates.dark_mode ? 1 : 0);
  }
  if (updates.keyboard_shortcuts !== undefined) {
    fields.push('keyboard_shortcuts = ?');
    values.push(updates.keyboard_shortcuts ? 1 : 0);
  }
  if (updates.preferred_sections !== undefined) {
    fields.push('preferred_sections = ?');
    values.push(JSON.stringify(updates.preferred_sections));
  }
  
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    const sql = `UPDATE user_settings SET ${fields.join(', ')} WHERE id = 1`;
    db.run(sql, values);
    saveDatabase();
  }
  
  return getUserSettings();
}

// ============================================
// Study Session Functions
// ============================================

export function createStudySession(input: CreateSessionInput): StudySession {
  const db = getDatabase();
  
  db.run(
    `INSERT INTO study_sessions (mode, level_at_start) VALUES (?, ?)`,
    [input.mode, input.level_at_start]
  );
  saveDatabase();
  
  // Get the last inserted session
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0]?.[0] as number;
  
  return getStudySession(id)!;
}

export function getStudySession(id: number): StudySession | null {
  const row = queryOne<StudySession>('SELECT * FROM study_sessions WHERE id = ?', [id]);
  return row ?? null;
}

export function updateStudySession(id: number, updates: UpdateSessionInput): StudySession | null {
  const db = getDatabase();
  
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  
  if (updates.ended_at !== undefined) {
    fields.push('ended_at = ?');
    values.push(updates.ended_at);
  }
  if (updates.duration_minutes !== undefined) {
    fields.push('duration_minutes = ?');
    values.push(updates.duration_minutes);
  }
  if (updates.questions_attempted !== undefined) {
    fields.push('questions_attempted = ?');
    values.push(updates.questions_attempted);
  }
  if (updates.questions_correct !== undefined) {
    fields.push('questions_correct = ?');
    values.push(updates.questions_correct);
  }
  if (updates.xp_earned !== undefined) {
    fields.push('xp_earned = ?');
    values.push(updates.xp_earned);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  
  if (fields.length > 0) {
    values.push(id);
    const sql = `UPDATE study_sessions SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values);
    saveDatabase();
  }
  
  return getStudySession(id);
}

export function endStudySession(id: number): StudySession | null {
  const session = getStudySession(id);
  if (!session) return null;
  
  const endedAt = new Date().toISOString();
  const startedAt = new Date(session.started_at);
  const durationMinutes = Math.round((new Date(endedAt).getTime() - startedAt.getTime()) / 60000);
  
  return updateStudySession(id, {
    ended_at: endedAt,
    duration_minutes: durationMinutes,
  });
}

export function getRecentSessions(limit: number = 10): StudySession[] {
  return query<StudySession>(
    'SELECT * FROM study_sessions ORDER BY started_at DESC LIMIT ?',
    [limit]
  );
}

export function getTodaySessions(): StudySession[] {
  return query<StudySession>(
    `SELECT * FROM study_sessions WHERE date(started_at) = date('now') ORDER BY started_at DESC`
  );
}

export function getTotalStudyMinutesToday(): number {
  const sessions = getTodaySessions();
  return sessions.reduce((total, session) => total + (session.duration_minutes ?? 0), 0);
}
