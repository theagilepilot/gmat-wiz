import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { getConfig } from '../config/index.js';

let db: SqlJsDatabase | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

/**
 * Initialize sql.js and the database connection
 */
export async function initializeDatabase(): Promise<SqlJsDatabase> {
  if (db) {
    return db;
  }

  const config = getConfig();
  const dbPath = config.databasePath;
  
  // Ensure the data directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 Created data directory: ${dbDir}`);
  }

  // Initialize SQL.js
  SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`💾 Database loaded: ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`💾 New database created: ${dbPath}`);
  }
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');
  
  return db;
}

/**
 * Get the database instance (must call initializeDatabase first)
 */
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Save the database to disk
 */
export function saveDatabase(): void {
  if (!db) {
    return;
  }
  
  const config = getConfig();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.databasePath, buffer);
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('💾 Database connection closed');
  }
}

/**
 * Run a callback within a transaction
 */
export function withTransaction<T>(callback: (db: SqlJsDatabase) => T): T {
  const database = getDatabase();
  try {
    database.run('BEGIN TRANSACTION');
    const result = callback(database);
    database.run('COMMIT');
    saveDatabase();
    return result;
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

/**
 * Check if a table exists
 */
export function tableExists(tableName: string): boolean {
  const database = getDatabase();
  const result = database.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
  );
  return result.length > 0 && result[0]!.values.length > 0;
}

/**
 * Execute a query and return results
 */
export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as T;
    results.push(row);
  }
  stmt.free();
  
  return results;
}

/**
 * Execute a query and return first result
 */
export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
export function execute(sql: string, params: unknown[] = []): void {
  const database = getDatabase();
  database.run(sql, params);
  saveDatabase();
}

// Cleanup on process exit
process.on('exit', closeDatabase);
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});
