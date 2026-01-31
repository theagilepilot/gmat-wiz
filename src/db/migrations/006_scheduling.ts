import type { Database as SqlJsDatabase } from 'sql.js';

export const migration006 = {
  name: '006_scheduling',
  
  up(db: SqlJsDatabase): void {
    // Training blocks (bundled question sets)
    db.run(`
      CREATE TABLE IF NOT EXISTS training_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Block identity
        name TEXT NOT NULL,
        block_type TEXT NOT NULL CHECK (block_type IN (
          'skill_build', 'timed_drill', 'review', 'diagnostic', 'mixed', 'custom'
        )),
        
        -- Configuration
        section_code TEXT,
        question_count INTEGER NOT NULL DEFAULT 10,
        time_limit_seconds INTEGER,
        difficulty_target INTEGER,
        
        -- Atom focus (JSON array of atom IDs)
        target_atoms TEXT NOT NULL DEFAULT '[]',
        
        -- Status
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'abandoned')),
        
        -- Progress
        questions_answered INTEGER NOT NULL DEFAULT 0,
        questions_correct INTEGER NOT NULL DEFAULT 0,
        
        -- Timing
        started_at TEXT,
        completed_at TEXT,
        time_spent_seconds INTEGER NOT NULL DEFAULT 0,
        
        -- Scheduling
        scheduled_for TEXT,
        priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
        
        -- Linked session
        session_id INTEGER,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE SET NULL
      )
    `);
    
    // Review queue (spaced repetition items)
    db.run(`
      CREATE TABLE IF NOT EXISTS review_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- What to review
        item_type TEXT NOT NULL CHECK (item_type IN ('question', 'atom', 'error')),
        item_id INTEGER NOT NULL,
        
        -- Spaced repetition values (SM-2 inspired)
        ease_factor REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 1,
        repetitions INTEGER NOT NULL DEFAULT 0,
        
        -- Quality of last review (0-5)
        last_quality INTEGER,
        
        -- Scheduling
        next_review_date TEXT NOT NULL,
        last_reviewed_at TEXT,
        
        -- Priority
        priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
        is_overdue INTEGER NOT NULL DEFAULT 0,
        
        -- Suspension
        is_suspended INTEGER NOT NULL DEFAULT 0,
        suspended_until TEXT,
        suspend_reason TEXT,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        UNIQUE(item_type, item_id)
      )
    `);
    
    // Mastery gates (requirements to unlock content)
    db.run(`
      CREATE TABLE IF NOT EXISTS mastery_gates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- What this gate unlocks
        gate_type TEXT NOT NULL CHECK (gate_type IN ('atom', 'topic', 'subtopic', 'section', 'difficulty_tier')),
        unlocks_code TEXT NOT NULL,
        
        -- Requirements (JSON)
        requirements TEXT NOT NULL,
        
        -- Status
        is_unlocked INTEGER NOT NULL DEFAULT 0,
        unlocked_at TEXT,
        
        -- Progress tracking
        progress_json TEXT NOT NULL DEFAULT '{}',
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        UNIQUE(gate_type, unlocks_code)
      )
    `);
    
    // Daily goals and targets
    db.run(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        
        -- Targets
        target_questions INTEGER NOT NULL DEFAULT 50,
        target_minutes INTEGER NOT NULL DEFAULT 90,
        target_accuracy REAL NOT NULL DEFAULT 0.75,
        target_new_atoms INTEGER NOT NULL DEFAULT 3,
        
        -- Actual progress
        questions_done INTEGER NOT NULL DEFAULT 0,
        minutes_studied INTEGER NOT NULL DEFAULT 0,
        accuracy_achieved REAL NOT NULL DEFAULT 0,
        new_atoms_learned INTEGER NOT NULL DEFAULT 0,
        
        -- XP and streaks
        xp_earned INTEGER NOT NULL DEFAULT 0,
        goals_met INTEGER NOT NULL DEFAULT 0,
        
        -- Notes
        notes TEXT,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Study plan templates
    db.run(`
      CREATE TABLE IF NOT EXISTS study_plan_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        
        -- Duration
        duration_weeks INTEGER NOT NULL,
        sessions_per_week INTEGER NOT NULL DEFAULT 5,
        minutes_per_session INTEGER NOT NULL DEFAULT 90,
        
        -- Structure (JSON)
        weekly_structure TEXT NOT NULL DEFAULT '[]',
        
        -- Target
        target_score INTEGER,
        target_percentile INTEGER,
        
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Active study plan
    db.run(`
      CREATE TABLE IF NOT EXISTS active_study_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER,
        
        -- Customization
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        custom_structure TEXT,
        
        -- Progress
        current_week INTEGER NOT NULL DEFAULT 1,
        current_day INTEGER NOT NULL DEFAULT 1,
        
        -- Status
        is_active INTEGER NOT NULL DEFAULT 1,
        
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        
        FOREIGN KEY (template_id) REFERENCES study_plan_templates(id) ON DELETE SET NULL
      )
    `);
    
    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_training_blocks_status ON training_blocks(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_training_blocks_scheduled ON training_blocks(scheduled_for)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_training_blocks_session ON training_blocks(session_id)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_review_queue_type ON review_queue(item_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_review_queue_next ON review_queue(next_review_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_review_queue_overdue ON review_queue(is_overdue)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_review_queue_suspended ON review_queue(is_suspended)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_mastery_gates_type ON mastery_gates(gate_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mastery_gates_unlocked ON mastery_gates(is_unlocked)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_daily_goals_date ON daily_goals(date)`);
    
    // Seed a default 4-month intensive study plan template
    db.run(`
      INSERT INTO study_plan_templates (name, description, duration_weeks, sessions_per_week, minutes_per_session, target_score, target_percentile, weekly_structure)
      VALUES (
        '4-Month Intensive',
        'Intensive 4-month plan targeting 750+ score. 5 days per week, 90 minutes per session.',
        16,
        5,
        90,
        750,
        96,
        '[
          {"week": 1, "focus": "diagnostic", "sections": ["quant", "verbal"], "goal": "baseline assessment"},
          {"week": 2, "focus": "foundations", "sections": ["quant"], "goal": "arithmetic, number properties"},
          {"week": 3, "focus": "foundations", "sections": ["quant"], "goal": "algebra fundamentals"},
          {"week": 4, "focus": "foundations", "sections": ["verbal"], "goal": "sentence correction basics"},
          {"week": 5, "focus": "skill_build", "sections": ["quant"], "goal": "geometry, coordinate geometry"},
          {"week": 6, "focus": "skill_build", "sections": ["quant"], "goal": "word problems, rate/work"},
          {"week": 7, "focus": "skill_build", "sections": ["verbal"], "goal": "critical reasoning"},
          {"week": 8, "focus": "skill_build", "sections": ["verbal"], "goal": "reading comprehension"},
          {"week": 9, "focus": "integration", "sections": ["quant", "verbal"], "goal": "data sufficiency mastery"},
          {"week": 10, "focus": "integration", "sections": ["quant", "verbal"], "goal": "advanced SC"},
          {"week": 11, "focus": "advanced", "sections": ["quant"], "goal": "700+ level quant"},
          {"week": 12, "focus": "advanced", "sections": ["verbal"], "goal": "700+ level verbal"},
          {"week": 13, "focus": "practice", "sections": ["quant", "verbal"], "goal": "full section practice"},
          {"week": 14, "focus": "practice", "sections": ["quant", "verbal", "ir"], "goal": "mock exams"},
          {"week": 15, "focus": "review", "sections": ["quant", "verbal"], "goal": "weakness remediation"},
          {"week": 16, "focus": "final", "sections": ["quant", "verbal", "ir", "awa"], "goal": "final prep"}
        ]'
      )
    `);
  },
  
  down(db: SqlJsDatabase): void {
    db.run(`DROP INDEX IF EXISTS idx_daily_goals_date`);
    db.run(`DROP INDEX IF EXISTS idx_mastery_gates_unlocked`);
    db.run(`DROP INDEX IF EXISTS idx_mastery_gates_type`);
    db.run(`DROP INDEX IF EXISTS idx_review_queue_suspended`);
    db.run(`DROP INDEX IF EXISTS idx_review_queue_overdue`);
    db.run(`DROP INDEX IF EXISTS idx_review_queue_next`);
    db.run(`DROP INDEX IF EXISTS idx_review_queue_type`);
    db.run(`DROP INDEX IF EXISTS idx_training_blocks_session`);
    db.run(`DROP INDEX IF EXISTS idx_training_blocks_scheduled`);
    db.run(`DROP INDEX IF EXISTS idx_training_blocks_status`);
    
    db.run(`DROP TABLE IF EXISTS active_study_plan`);
    db.run(`DROP TABLE IF EXISTS study_plan_templates`);
    db.run(`DROP TABLE IF EXISTS daily_goals`);
    db.run(`DROP TABLE IF EXISTS mastery_gates`);
    db.run(`DROP TABLE IF EXISTS review_queue`);
    db.run(`DROP TABLE IF EXISTS training_blocks`);
  },
};
