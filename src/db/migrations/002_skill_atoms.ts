import type { Database as SqlJsDatabase } from 'sql.js';

export const migration002 = {
  name: '002_skill_atoms',
  
  up(db: SqlJsDatabase): void {
    // Sections (Quant, Verbal, IR, AWA)
    db.run(`
      CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Topics within sections
    db.run(`
      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      )
    `);
    
    // Subtopics within topics
    db.run(`
      CREATE TABLE IF NOT EXISTS subtopics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
      )
    `);
    
    // Atoms - the finest grain of skill
    db.run(`
      CREATE TABLE IF NOT EXISTS atoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtopic_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        difficulty_tier INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_tier BETWEEN 1 AND 5),
        is_foundational INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (subtopic_id) REFERENCES subtopics(id) ON DELETE CASCADE
      )
    `);
    
    // Atom prerequisites (which atoms must be mastered before this one)
    db.run(`
      CREATE TABLE IF NOT EXISTS atom_prerequisites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        atom_id INTEGER NOT NULL,
        prerequisite_atom_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (atom_id) REFERENCES atoms(id) ON DELETE CASCADE,
        FOREIGN KEY (prerequisite_atom_id) REFERENCES atoms(id) ON DELETE CASCADE,
        UNIQUE(atom_id, prerequisite_atom_id)
      )
    `);
    
    // Question types (Data Sufficiency, Problem Solving, etc.)
    db.run(`
      CREATE TABLE IF NOT EXISTS question_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        time_budget_seconds INTEGER NOT NULL DEFAULT 120,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      )
    `);
    
    // Method archetypes (fastest valid approaches)
    db.run(`
      CREATE TABLE IF NOT EXISTS method_archetypes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        applicable_sections TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Trap archetypes (common mistake patterns)
    db.run(`
      CREATE TABLE IF NOT EXISTS trap_archetypes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        applicable_sections TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Create indexes for performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_topics_section ON topics(section_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atoms_subtopic ON atoms(subtopic_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atoms_difficulty ON atoms(difficulty_tier)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atom_prereqs_atom ON atom_prerequisites(atom_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_question_types_section ON question_types(section_id)`);
  },
  
  down(db: SqlJsDatabase): void {
    db.run(`DROP INDEX IF EXISTS idx_question_types_section`);
    db.run(`DROP INDEX IF EXISTS idx_atom_prereqs_atom`);
    db.run(`DROP INDEX IF EXISTS idx_atoms_difficulty`);
    db.run(`DROP INDEX IF EXISTS idx_atoms_subtopic`);
    db.run(`DROP INDEX IF EXISTS idx_subtopics_topic`);
    db.run(`DROP INDEX IF EXISTS idx_topics_section`);
    db.run(`DROP TABLE IF EXISTS trap_archetypes`);
    db.run(`DROP TABLE IF EXISTS method_archetypes`);
    db.run(`DROP TABLE IF EXISTS question_types`);
    db.run(`DROP TABLE IF EXISTS atom_prerequisites`);
    db.run(`DROP TABLE IF EXISTS atoms`);
    db.run(`DROP TABLE IF EXISTS subtopics`);
    db.run(`DROP TABLE IF EXISTS topics`);
    db.run(`DROP TABLE IF EXISTS sections`);
  },
};
