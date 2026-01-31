import { getDatabase, tableExists, saveDatabase } from '../connection.js';
import { Database as SqlJsDatabase } from 'sql.js';

interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

interface Migration {
  name: string;
  up: (db: SqlJsDatabase) => void;
  down: (db: SqlJsDatabase) => void;
}

// Import migrations
import { migration001 } from './001_initial_schema.js';

// Register all migrations in order
const migrations: Migration[] = [
  migration001,
  // Future migrations will be added here:
  // migration002,
  // migration003,
];

/**
 * Ensure the migrations table exists
 */
function ensureMigrationsTable(): void {
  const db = getDatabase();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  saveDatabase();
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(): Set<string> {
  const db = getDatabase();
  
  if (!tableExists('migrations')) {
    return new Set();
  }
  
  const result = db.exec('SELECT name FROM migrations');
  if (result.length === 0) {
    return new Set();
  }
  
  const names = result[0]!.values.map(row => row[0] as string);
  return new Set(names);
}

/**
 * Run all pending migrations
 */
export function runMigrations(): void {
  console.log('🔄 Running database migrations...\n');
  
  ensureMigrationsTable();
  
  const db = getDatabase();
  const applied = getAppliedMigrations();
  let ranCount = 0;
  
  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      console.log(`  ⏭️  ${migration.name} (already applied)`);
      continue;
    }
    
    console.log(`  ⬆️  Running: ${migration.name}`);
    
    try {
      // Run migration in a transaction
      db.run('BEGIN TRANSACTION');
      migration.up(db);
      db.run(`INSERT INTO migrations (name) VALUES ('${migration.name}')`);
      db.run('COMMIT');
      saveDatabase();
      
      console.log(`  ✅ ${migration.name} applied`);
      ranCount++;
    } catch (error) {
      db.run('ROLLBACK');
      console.error(`  ❌ Failed: ${migration.name}`);
      throw error;
    }
  }
  
  if (ranCount === 0) {
    console.log('\n✅ All migrations already applied');
  } else {
    console.log(`\n✅ Applied ${ranCount} migration(s)`);
  }
}

/**
 * Rollback the last migration
 */
export function rollbackLastMigration(): void {
  console.log('🔄 Rolling back last migration...\n');
  
  const db = getDatabase();
  const applied = getAppliedMigrations();
  
  if (applied.size === 0) {
    console.log('No migrations to rollback');
    return;
  }
  
  // Find the last applied migration
  const result = db.exec('SELECT name FROM migrations ORDER BY id DESC LIMIT 1');
  if (result.length === 0 || result[0]!.values.length === 0) {
    console.log('No migrations to rollback');
    return;
  }
  
  const lastAppliedName = result[0]!.values[0]![0] as string;
  const migration = migrations.find(m => m.name === lastAppliedName);
  
  if (!migration) {
    console.error(`Migration ${lastAppliedName} not found in code`);
    return;
  }
  
  console.log(`  ⬇️  Rolling back: ${migration.name}`);
  
  try {
    db.run('BEGIN TRANSACTION');
    migration.down(db);
    db.run(`DELETE FROM migrations WHERE name = '${migration.name}'`);
    db.run('COMMIT');
    saveDatabase();
    
    console.log(`  ✅ ${migration.name} rolled back`);
  } catch (error) {
    db.run('ROLLBACK');
    console.error(`  ❌ Rollback failed: ${migration.name}`);
    throw error;
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(): { name: string; applied: boolean; appliedAt?: string }[] {
  ensureMigrationsTable();
  
  const db = getDatabase();
  const appliedMap = new Map<string, string>();
  
  const result = db.exec('SELECT name, applied_at FROM migrations');
  if (result.length > 0) {
    for (const row of result[0]!.values) {
      appliedMap.set(row[0] as string, row[1] as string);
    }
  }
  
  return migrations.map(m => ({
    name: m.name,
    applied: appliedMap.has(m.name),
    appliedAt: appliedMap.get(m.name),
  }));
}

// Run migrations if this file is executed directly
const isMainModule = process.argv[1]?.includes('migrations');
if (isMainModule) {
  const command = process.argv[2];
  
  // Initialize database
  const { initializeDatabase } = await import('../connection.js');
  await initializeDatabase();
  
  switch (command) {
    case 'rollback':
      rollbackLastMigration();
      break;
    case 'status':
      console.log('\n📊 Migration Status:\n');
      for (const status of getMigrationStatus()) {
        const icon = status.applied ? '✅' : '⬜';
        const date = status.appliedAt ? ` (${status.appliedAt})` : '';
        console.log(`  ${icon} ${status.name}${date}`);
      }
      console.log('');
      break;
    default:
      runMigrations();
  }
  
  process.exit(0);
}
