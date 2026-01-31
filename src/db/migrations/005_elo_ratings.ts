import type { Database as SqlJsDatabase } from 'sql.js';

export const migration005 = {
  name: '005_elo_ratings',
  
  up(db: SqlJsDatabase): void {
    // User ELO ratings (current state)
    db.run(`
      CREATE TABLE IF NOT EXISTS elo_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Scope of this rating
        scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'section', 'topic', 'atom')),
        scope_code TEXT,
        
        -- Rating values
        rating INTEGER NOT NULL DEFAULT 500,
        rating_deviation INTEGER NOT NULL DEFAULT 350,
        volatility REAL NOT NULL DEFAULT 0.06,
        
        -- Confidence metrics
        games_played INTEGER NOT NULL DEFAULT 0,
        confidence_level REAL NOT NULL DEFAULT 0,
        
        -- Peak tracking
        peak_rating INTEGER NOT NULL DEFAULT 500,
        peak_date TEXT,
        
        -- Recent performance
        last_5_results TEXT NOT NULL DEFAULT '[]',
        current_streak INTEGER NOT NULL DEFAULT 0,
        streak_type TEXT CHECK (streak_type IN ('win', 'loss', NULL)),
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        UNIQUE(scope_type, scope_code)
      )
    `);
    
    // ELO rating history (for graphing and analysis)
    db.run(`
      CREATE TABLE IF NOT EXISTS elo_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Reference to the rating
        elo_rating_id INTEGER NOT NULL,
        
        -- Snapshot values
        rating_before INTEGER NOT NULL,
        rating_after INTEGER NOT NULL,
        rating_change INTEGER NOT NULL,
        
        deviation_before INTEGER NOT NULL,
        deviation_after INTEGER NOT NULL,
        
        -- Context
        attempt_id INTEGER,
        question_difficulty INTEGER,
        was_correct INTEGER NOT NULL,
        expected_score REAL NOT NULL,
        
        recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (elo_rating_id) REFERENCES elo_ratings(id) ON DELETE CASCADE,
        FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE SET NULL
      )
    `);
    
    // Atom mastery tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS atom_mastery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        atom_id INTEGER NOT NULL UNIQUE,
        
        -- Mastery state
        mastery_level TEXT NOT NULL DEFAULT 'unstarted' CHECK (
          mastery_level IN ('unstarted', 'learning', 'practicing', 'mastered', 'reviewing')
        ),
        
        -- Metrics
        attempts_total INTEGER NOT NULL DEFAULT 0,
        attempts_correct INTEGER NOT NULL DEFAULT 0,
        accuracy REAL NOT NULL DEFAULT 0,
        
        -- Rolling accuracy (last N attempts)
        recent_accuracy REAL NOT NULL DEFAULT 0,
        recent_attempts TEXT NOT NULL DEFAULT '[]',
        
        -- Time metrics
        avg_time_seconds REAL,
        best_time_seconds INTEGER,
        
        -- Mastery gates
        meets_accuracy_gate INTEGER NOT NULL DEFAULT 0,
        meets_attempts_gate INTEGER NOT NULL DEFAULT 0,
        meets_streak_gate INTEGER NOT NULL DEFAULT 0,
        
        -- Dates
        first_attempt_at TEXT,
        last_attempt_at TEXT,
        mastered_at TEXT,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (atom_id) REFERENCES atoms(id) ON DELETE CASCADE
      )
    `);
    
    // Performance benchmarks (for comparing to target percentiles)
    db.run(`
      CREATE TABLE IF NOT EXISTS performance_benchmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'section', 'topic')),
        scope_code TEXT,
        percentile INTEGER NOT NULL CHECK (percentile BETWEEN 0 AND 100),
        rating_threshold INTEGER NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(scope_type, scope_code, percentile)
      )
    `);
    
    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_elo_ratings_scope ON elo_ratings(scope_type, scope_code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_elo_ratings_rating ON elo_ratings(rating)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_elo_history_rating_id ON elo_history(elo_rating_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_elo_history_recorded ON elo_history(recorded_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atom_mastery_atom ON atom_mastery(atom_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atom_mastery_level ON atom_mastery(mastery_level)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_benchmarks_scope ON performance_benchmarks(scope_type, scope_code)`);
    
    // Seed initial global ELO rating
    db.run(`
      INSERT OR IGNORE INTO elo_ratings (scope_type, scope_code, rating, rating_deviation)
      VALUES ('global', NULL, 500, 350)
    `);
    
    // Seed section ELO ratings
    db.run(`INSERT OR IGNORE INTO elo_ratings (scope_type, scope_code) VALUES ('section', 'quant')`);
    db.run(`INSERT OR IGNORE INTO elo_ratings (scope_type, scope_code) VALUES ('section', 'verbal')`);
    db.run(`INSERT OR IGNORE INTO elo_ratings (scope_type, scope_code) VALUES ('section', 'ir')`);
    db.run(`INSERT OR IGNORE INTO elo_ratings (scope_type, scope_code) VALUES ('section', 'awa')`);
    
    // Seed performance benchmarks (based on GMAT percentiles)
    const benchmarks = [
      { percentile: 99, rating: 800, desc: 'Elite (750-800 GMAT)' },
      { percentile: 90, rating: 700, desc: 'Excellent (700-740 GMAT)' },
      { percentile: 75, rating: 620, desc: 'Good (650-690 GMAT)' },
      { percentile: 50, rating: 550, desc: 'Average (550-640 GMAT)' },
      { percentile: 25, rating: 450, desc: 'Below Average (400-540 GMAT)' },
    ];
    
    for (const b of benchmarks) {
      db.run(`
        INSERT OR IGNORE INTO performance_benchmarks (scope_type, scope_code, percentile, rating_threshold, description)
        VALUES ('global', NULL, ?, ?, ?)
      `, [b.percentile, b.rating, b.desc]);
    }
  },
  
  down(db: SqlJsDatabase): void {
    db.run(`DROP INDEX IF EXISTS idx_benchmarks_scope`);
    db.run(`DROP INDEX IF EXISTS idx_atom_mastery_level`);
    db.run(`DROP INDEX IF EXISTS idx_atom_mastery_atom`);
    db.run(`DROP INDEX IF EXISTS idx_elo_history_recorded`);
    db.run(`DROP INDEX IF EXISTS idx_elo_history_rating_id`);
    db.run(`DROP INDEX IF EXISTS idx_elo_ratings_rating`);
    db.run(`DROP INDEX IF EXISTS idx_elo_ratings_scope`);
    
    db.run(`DROP TABLE IF EXISTS performance_benchmarks`);
    db.run(`DROP TABLE IF EXISTS atom_mastery`);
    db.run(`DROP TABLE IF EXISTS elo_history`);
    db.run(`DROP TABLE IF EXISTS elo_ratings`);
  },
};
