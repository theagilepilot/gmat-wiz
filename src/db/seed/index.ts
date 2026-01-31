import { getDatabase, saveDatabase } from '../connection.js';
import { Database as SqlJsDatabase } from 'sql.js';

// Import seeders
// These will be added in Phase 3
// import { seedQuantTaxonomy } from './quant-taxonomy.js';
// import { seedVerbalTaxonomy } from './verbal-taxonomy.js';
// import { seedIRTaxonomy } from './ir-taxonomy.js';
// import { seedAWATaxonomy } from './awa-taxonomy.js';
// import { seedLevels } from './levels.js';

interface Seeder {
  name: string;
  run: (db: SqlJsDatabase) => void;
}

// Register all seeders in order
const seeders: Seeder[] = [
  // Will be populated in Phase 3:
  // { name: 'Quant Taxonomy', run: seedQuantTaxonomy },
  // { name: 'Verbal Taxonomy', run: seedVerbalTaxonomy },
  // { name: 'IR Taxonomy', run: seedIRTaxonomy },
  // { name: 'AWA Taxonomy', run: seedAWATaxonomy },
  // { name: 'Levels & Gates', run: seedLevels },
];

/**
 * Run all seeders
 */
export function runSeeders(): void {
  console.log('🌱 Running database seeders...\n');
  
  const db = getDatabase();
  
  if (seeders.length === 0) {
    console.log('  ℹ️  No seeders registered yet (coming in Phase 3)\n');
    return;
  }
  
  for (const seeder of seeders) {
    console.log(`  🌱 Seeding: ${seeder.name}`);
    
    try {
      db.run('BEGIN TRANSACTION');
      seeder.run(db);
      db.run('COMMIT');
      saveDatabase();
      
      console.log(`  ✅ ${seeder.name} complete`);
    } catch (error) {
      db.run('ROLLBACK');
      console.error(`  ❌ Failed: ${seeder.name}`);
      throw error;
    }
  }
  
  console.log(`\n✅ Seeding complete`);
}

/**
 * Clear all seeded data (for development)
 */
export function clearSeededData(): void {
  console.log('🗑️  Clearing seeded data...\n');
  
  const db = getDatabase();
  
  // Tables to clear (in reverse dependency order)
  const tablesToClear = [
    // These will be added as tables are created
    // 'mastery_gates',
    // 'training_blocks',
    // 'review_queue',
    // 'rating_history',
    // 'elo_ratings',
    // 'error_logs',
    // 'attempts',
    // 'questions',
    // 'atoms',
    // 'subtopics',
    // 'topics',
    // 'sections',
  ];
  
  for (const table of tablesToClear) {
    try {
      db.run(`DELETE FROM ${table}`);
      saveDatabase();
      console.log(`  ✅ Cleared: ${table}`);
    } catch {
      // Table might not exist yet
      console.log(`  ⏭️  Skipped: ${table} (not found)`);
    }
  }
  
  console.log('\n✅ Seeded data cleared');
}

// Run seeders if this file is executed directly
const isMainModule = process.argv[1]?.includes('seed');
if (isMainModule) {
  const command = process.argv[2];
  
  // Initialize database and run migrations first
  const { initializeDatabase } = await import('../connection.js');
  const { runMigrations } = await import('../migrations/index.js');
  
  await initializeDatabase();
  runMigrations();
  
  console.log('');
  
  switch (command) {
    case 'clear':
      clearSeededData();
      break;
    default:
      runSeeders();
  }
  
  process.exit(0);
}
