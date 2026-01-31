import type { Database as SqlJsDatabase } from 'sql.js';

export const migration001 = {
  name: '001_initial_schema',
  
  up(db: SqlJsDatabase): void {
    // User profile - single user for now
    db.run(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        current_level INTEGER NOT NULL DEFAULT 1,
        total_xp INTEGER NOT NULL DEFAULT 0,
        study_streak_days INTEGER NOT NULL DEFAULT 0,
        last_study_date TEXT,
        total_study_minutes INTEGER NOT NULL DEFAULT 0,
        total_questions_attempted INTEGER NOT NULL DEFAULT 0,
        total_questions_correct INTEGER NOT NULL DEFAULT 0
      )
    `);
    
    // Insert default user profile
    db.run(`
      INSERT OR IGNORE INTO user_profile (id) VALUES (1)
    `);
    
    // User settings
    db.run(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        daily_goal_minutes INTEGER NOT NULL DEFAULT 60,
        hints_enabled INTEGER NOT NULL DEFAULT 1,
        sound_enabled INTEGER NOT NULL DEFAULT 1,
        dark_mode INTEGER NOT NULL DEFAULT 1,
        keyboard_shortcuts INTEGER NOT NULL DEFAULT 1,
        preferred_sections TEXT DEFAULT '["quant","verbal","ir","awa"]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Insert default settings
    db.run(`
      INSERT OR IGNORE INTO user_settings (id) VALUES (1)
    `);
    
    // Session tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        duration_minutes INTEGER,
        questions_attempted INTEGER NOT NULL DEFAULT 0,
        questions_correct INTEGER NOT NULL DEFAULT 0,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL CHECK (mode IN ('build', 'prove')),
        level_at_start INTEGER NOT NULL,
        notes TEXT
      )
    `);
    
    // Create indexes
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON study_sessions(started_at)
    `);
    
    // Note: sql.js doesn't support triggers the same way, so we'll handle timestamps in application code
  },
  
  down(db: SqlJsDatabase): void {
    db.run(`DROP INDEX IF EXISTS idx_sessions_started_at`);
    db.run(`DROP TABLE IF EXISTS study_sessions`);
    db.run(`DROP TABLE IF EXISTS user_settings`);
    db.run(`DROP TABLE IF EXISTS user_profile`);
  },
};
