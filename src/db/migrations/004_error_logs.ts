import type { Database as SqlJsDatabase } from 'sql.js';

export const migration004 = {
  name: '004_error_logs',
  
  up(db: SqlJsDatabase): void {
    // Error type definitions (master list of error categories)
    db.run(`
      CREATE TABLE IF NOT EXISTS error_type_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('conceptual', 'computational', 'reading', 'strategy', 'timing', 'careless')),
        description TEXT,
        remediation_tips TEXT,
        applicable_sections TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Error logs - reflection-first error tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Reference to attempt
        attempt_id INTEGER NOT NULL UNIQUE,
        
        -- Classification
        error_type_code TEXT NOT NULL,
        
        -- Root cause analysis (the reflection)
        root_cause TEXT NOT NULL,
        
        -- What the user thought vs reality
        user_reasoning TEXT,
        correct_reasoning TEXT,
        
        -- Trap identification
        trap_archetype_code TEXT,
        fell_for_trap INTEGER NOT NULL DEFAULT 0,
        
        -- Method analysis
        method_used_code TEXT,
        optimal_method_code TEXT,
        method_was_wrong INTEGER NOT NULL DEFAULT 0,
        
        -- Knowledge gaps identified
        knowledge_gaps TEXT NOT NULL DEFAULT '[]',
        
        -- Action items for remediation
        action_items TEXT NOT NULL DEFAULT '[]',
        
        -- Confidence calibration
        was_overconfident INTEGER NOT NULL DEFAULT 0,
        was_underconfident INTEGER NOT NULL DEFAULT 0,
        
        -- Pattern linking (did this error relate to previous errors?)
        related_error_ids TEXT NOT NULL DEFAULT '[]',
        
        -- Severity (how critical is this error type)
        severity INTEGER NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
        
        -- Resolution tracking
        is_resolved INTEGER NOT NULL DEFAULT 0,
        resolution_notes TEXT,
        resolved_at TEXT,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (error_type_code) REFERENCES error_type_definitions(code),
        FOREIGN KEY (trap_archetype_code) REFERENCES trap_archetypes(code),
        FOREIGN KEY (method_used_code) REFERENCES method_archetypes(code),
        FOREIGN KEY (optimal_method_code) REFERENCES method_archetypes(code)
      )
    `);
    
    // Error-Atom associations (which atoms were involved in this error)
    db.run(`
      CREATE TABLE IF NOT EXISTS error_atoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_log_id INTEGER NOT NULL,
        atom_id INTEGER NOT NULL,
        is_primary_gap INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (error_log_id) REFERENCES error_logs(id) ON DELETE CASCADE,
        FOREIGN KEY (atom_id) REFERENCES atoms(id) ON DELETE CASCADE,
        UNIQUE(error_log_id, atom_id)
      )
    `);
    
    // Error patterns (recurring error combinations)
    db.run(`
      CREATE TABLE IF NOT EXISTS error_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        error_type_codes TEXT NOT NULL DEFAULT '[]',
        atom_codes TEXT NOT NULL DEFAULT '[]',
        trigger_conditions TEXT,
        occurrence_count INTEGER NOT NULL DEFAULT 0,
        last_occurrence TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Error pattern instances
    db.run(`
      CREATE TABLE IF NOT EXISTS error_pattern_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id INTEGER NOT NULL,
        error_log_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (pattern_id) REFERENCES error_patterns(id) ON DELETE CASCADE,
        FOREIGN KEY (error_log_id) REFERENCES error_logs(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_type_defs_category ON error_type_definitions(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_logs_attempt ON error_logs(attempt_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type_code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(is_resolved)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_atoms_error ON error_atoms(error_log_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_atoms_atom ON error_atoms(atom_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_patterns_active ON error_patterns(is_active)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_pattern_instances_pattern ON error_pattern_instances(pattern_id)`);
  },
  
  down(db: SqlJsDatabase): void {
    db.run(`DROP INDEX IF EXISTS idx_error_pattern_instances_pattern`);
    db.run(`DROP INDEX IF EXISTS idx_error_patterns_active`);
    db.run(`DROP INDEX IF EXISTS idx_error_atoms_atom`);
    db.run(`DROP INDEX IF EXISTS idx_error_atoms_error`);
    db.run(`DROP INDEX IF EXISTS idx_error_logs_created`);
    db.run(`DROP INDEX IF EXISTS idx_error_logs_resolved`);
    db.run(`DROP INDEX IF EXISTS idx_error_logs_type`);
    db.run(`DROP INDEX IF EXISTS idx_error_logs_attempt`);
    db.run(`DROP INDEX IF EXISTS idx_error_type_defs_category`);
    
    db.run(`DROP TABLE IF EXISTS error_pattern_instances`);
    db.run(`DROP TABLE IF EXISTS error_patterns`);
    db.run(`DROP TABLE IF EXISTS error_atoms`);
    db.run(`DROP TABLE IF EXISTS error_logs`);
    db.run(`DROP TABLE IF EXISTS error_type_definitions`);
  },
};
