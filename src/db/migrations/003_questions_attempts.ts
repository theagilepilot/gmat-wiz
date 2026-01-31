import type { Database as SqlJsDatabase } from 'sql.js';

export const migration003 = {
  name: '003_questions_attempts',
  
  up(db: SqlJsDatabase): void {
    // Questions table - stores both seeded and AI-generated questions
    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Identity
        external_id TEXT UNIQUE,
        source TEXT NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded', 'ai_generated', 'user_created', 'official')),
        
        -- Classification
        section_code TEXT NOT NULL,
        question_type_code TEXT NOT NULL,
        
        -- Content (JSON for flexibility)
        stem TEXT NOT NULL,
        answer_choices TEXT,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        
        -- For Data Sufficiency
        statement_1 TEXT,
        statement_2 TEXT,
        
        -- Difficulty & tagging
        difficulty_rating INTEGER NOT NULL DEFAULT 500,
        estimated_time_seconds INTEGER NOT NULL DEFAULT 120,
        tags TEXT NOT NULL DEFAULT '[]',
        
        -- AI generation metadata
        ai_model TEXT,
        ai_prompt_hash TEXT,
        generation_params TEXT,
        
        -- Quality tracking
        quality_score REAL DEFAULT NULL,
        times_served INTEGER NOT NULL DEFAULT 0,
        times_correct INTEGER NOT NULL DEFAULT 0,
        avg_time_taken REAL DEFAULT NULL,
        
        -- Status
        is_active INTEGER NOT NULL DEFAULT 1,
        is_verified INTEGER NOT NULL DEFAULT 0,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Question-Atom mapping (many-to-many)
    db.run(`
      CREATE TABLE IF NOT EXISTS question_atoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        atom_id INTEGER NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (atom_id) REFERENCES atoms(id) ON DELETE CASCADE,
        UNIQUE(question_id, atom_id)
      )
    `);
    
    // Question attempts - every question answer
    db.run(`
      CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- References
        question_id INTEGER NOT NULL,
        session_id INTEGER,
        training_block_id INTEGER,
        
        -- User response
        user_answer TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        
        -- Timing
        time_started TEXT NOT NULL,
        time_submitted TEXT NOT NULL,
        time_taken_seconds INTEGER NOT NULL,
        was_overtime INTEGER NOT NULL DEFAULT 0,
        
        -- State at time of attempt
        user_elo_at_attempt INTEGER NOT NULL DEFAULT 500,
        question_difficulty_at_attempt INTEGER NOT NULL,
        
        -- Confidence & certainty
        confidence_before INTEGER CHECK (confidence_before BETWEEN 1 AND 5),
        confidence_after INTEGER CHECK (confidence_after BETWEEN 1 AND 5),
        
        -- Method used (links to method_archetypes)
        method_code TEXT,
        method_was_optimal INTEGER,
        
        -- Flags
        was_guessed INTEGER NOT NULL DEFAULT 0,
        marked_for_review INTEGER NOT NULL DEFAULT 0,
        
        -- Notes
        user_notes TEXT,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE SET NULL,
        FOREIGN KEY (training_block_id) REFERENCES training_blocks(id) ON DELETE SET NULL
      )
    `);
    
    // Attempt-Atom association (for tracking which atoms were tested)
    db.run(`
      CREATE TABLE IF NOT EXISTS attempt_atoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL,
        atom_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (atom_id) REFERENCES atoms(id) ON DELETE CASCADE,
        UNIQUE(attempt_id, atom_id)
      )
    `);
    
    // Question feedback (for improving AI generation)
    db.run(`
      CREATE TABLE IF NOT EXISTS question_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        feedback_type TEXT NOT NULL CHECK (feedback_type IN ('quality', 'difficulty', 'clarity', 'error', 'duplicate')),
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section_code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type_code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty_rating)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_question_atoms_question ON question_atoms(question_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_question_atoms_atom ON question_atoms(atom_id)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempts_block ON attempts(training_block_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempts_correct ON attempts(is_correct)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempt_atoms_attempt ON attempt_atoms(attempt_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attempt_atoms_atom ON attempt_atoms(atom_id)`);
  },
  
  down(db: SqlJsDatabase): void {
    db.run(`DROP INDEX IF EXISTS idx_attempt_atoms_atom`);
    db.run(`DROP INDEX IF EXISTS idx_attempt_atoms_attempt`);
    db.run(`DROP INDEX IF EXISTS idx_attempts_correct`);
    db.run(`DROP INDEX IF EXISTS idx_attempts_created`);
    db.run(`DROP INDEX IF EXISTS idx_attempts_block`);
    db.run(`DROP INDEX IF EXISTS idx_attempts_session`);
    db.run(`DROP INDEX IF EXISTS idx_attempts_question`);
    db.run(`DROP INDEX IF EXISTS idx_question_atoms_atom`);
    db.run(`DROP INDEX IF EXISTS idx_question_atoms_question`);
    db.run(`DROP INDEX IF EXISTS idx_questions_active`);
    db.run(`DROP INDEX IF EXISTS idx_questions_source`);
    db.run(`DROP INDEX IF EXISTS idx_questions_difficulty`);
    db.run(`DROP INDEX IF EXISTS idx_questions_type`);
    db.run(`DROP INDEX IF EXISTS idx_questions_section`);
    
    db.run(`DROP TABLE IF EXISTS question_feedback`);
    db.run(`DROP TABLE IF EXISTS attempt_atoms`);
    db.run(`DROP TABLE IF EXISTS attempts`);
    db.run(`DROP TABLE IF EXISTS question_atoms`);
    db.run(`DROP TABLE IF EXISTS questions`);
  },
};
