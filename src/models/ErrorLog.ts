/**
 * Error Log Model
 * Reflection-first error tracking and pattern recognition
 */

import { getDatabase, query, queryOne, saveDatabase } from '../db/connection.js';

// ============================================
// Types
// ============================================

export type ErrorCategory = 'conceptual' | 'computational' | 'reading' | 'strategy' | 'timing' | 'careless';

export interface ErrorTypeDefinition {
  id: number;
  code: string;
  name: string;
  category: ErrorCategory;
  description: string | null;
  remediation_tips: string | null;
  applicable_sections: string[];
  created_at: string;
}

export interface ErrorLog {
  id: number;
  attempt_id: number;
  error_type_code: string;
  root_cause: string;
  user_reasoning: string | null;
  correct_reasoning: string | null;
  trap_archetype_code: string | null;
  fell_for_trap: boolean;
  method_used_code: string | null;
  optimal_method_code: string | null;
  method_was_wrong: boolean;
  knowledge_gaps: string[];
  action_items: string[];
  was_overconfident: boolean;
  was_underconfident: boolean;
  related_error_ids: number[];
  severity: number;
  is_resolved: boolean;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErrorLogCreateInput {
  attempt_id: number;
  error_type_code: string;
  root_cause: string;
  user_reasoning?: string;
  correct_reasoning?: string;
  trap_archetype_code?: string;
  fell_for_trap?: boolean;
  method_used_code?: string;
  optimal_method_code?: string;
  method_was_wrong?: boolean;
  knowledge_gaps?: string[];
  action_items?: string[];
  was_overconfident?: boolean;
  was_underconfident?: boolean;
  related_error_ids?: number[];
  severity?: number;
}

export interface ErrorPattern {
  id: number;
  name: string;
  description: string | null;
  error_type_codes: string[];
  atom_codes: string[];
  trigger_conditions: string | null;
  occurrence_count: number;
  last_occurrence: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ErrorAtom {
  id: number;
  error_log_id: number;
  atom_id: number;
  is_primary_gap: boolean;
  created_at: string;
}

// ============================================
// Helper Functions
// ============================================

function parseErrorTypeDefinition(row: Record<string, unknown>): ErrorTypeDefinition {
  return {
    id: row.id as number,
    code: row.code as string,
    name: row.name as string,
    category: row.category as ErrorCategory,
    description: row.description as string | null,
    remediation_tips: row.remediation_tips as string | null,
    applicable_sections: JSON.parse(row.applicable_sections as string || '[]'),
    created_at: row.created_at as string,
  };
}

function parseErrorLog(row: Record<string, unknown>): ErrorLog {
  return {
    id: row.id as number,
    attempt_id: row.attempt_id as number,
    error_type_code: row.error_type_code as string,
    root_cause: row.root_cause as string,
    user_reasoning: row.user_reasoning as string | null,
    correct_reasoning: row.correct_reasoning as string | null,
    trap_archetype_code: row.trap_archetype_code as string | null,
    fell_for_trap: row.fell_for_trap === 1,
    method_used_code: row.method_used_code as string | null,
    optimal_method_code: row.optimal_method_code as string | null,
    method_was_wrong: row.method_was_wrong === 1,
    knowledge_gaps: JSON.parse(row.knowledge_gaps as string || '[]'),
    action_items: JSON.parse(row.action_items as string || '[]'),
    was_overconfident: row.was_overconfident === 1,
    was_underconfident: row.was_underconfident === 1,
    related_error_ids: JSON.parse(row.related_error_ids as string || '[]'),
    severity: row.severity as number,
    is_resolved: row.is_resolved === 1,
    resolution_notes: row.resolution_notes as string | null,
    resolved_at: row.resolved_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseErrorPattern(row: Record<string, unknown>): ErrorPattern {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string | null,
    error_type_codes: JSON.parse(row.error_type_codes as string || '[]'),
    atom_codes: JSON.parse(row.atom_codes as string || '[]'),
    trigger_conditions: row.trigger_conditions as string | null,
    occurrence_count: row.occurrence_count as number,
    last_occurrence: row.last_occurrence as string | null,
    is_active: row.is_active === 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================
// Error Type Definition Functions
// ============================================

export function getAllErrorTypes(): ErrorTypeDefinition[] {
  const rows = query<Record<string, unknown>>('SELECT * FROM error_type_definitions ORDER BY category, name');
  return rows.map(parseErrorTypeDefinition);
}

export function getErrorTypeByCode(code: string): ErrorTypeDefinition | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM error_type_definitions WHERE code = ?', [code]);
  return row ? parseErrorTypeDefinition(row) : null;
}

export function getErrorTypesByCategory(category: ErrorCategory): ErrorTypeDefinition[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM error_type_definitions WHERE category = ? ORDER BY name',
    [category]
  );
  return rows.map(parseErrorTypeDefinition);
}

export function getErrorTypesForSection(sectionCode: string): ErrorTypeDefinition[] {
  const all = getAllErrorTypes();
  return all.filter(et => et.applicable_sections.includes(sectionCode) || et.applicable_sections.length === 0);
}

// ============================================
// Error Log Functions
// ============================================

export function createErrorLog(input: ErrorLogCreateInput): ErrorLog {
  const db = getDatabase();
  
  db.run(`
    INSERT INTO error_logs (
      attempt_id, error_type_code, root_cause,
      user_reasoning, correct_reasoning,
      trap_archetype_code, fell_for_trap,
      method_used_code, optimal_method_code, method_was_wrong,
      knowledge_gaps, action_items,
      was_overconfident, was_underconfident,
      related_error_ids, severity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.attempt_id,
    input.error_type_code,
    input.root_cause,
    input.user_reasoning ?? null,
    input.correct_reasoning ?? null,
    input.trap_archetype_code ?? null,
    (input.fell_for_trap ?? false) ? 1 : 0,
    input.method_used_code ?? null,
    input.optimal_method_code ?? null,
    (input.method_was_wrong ?? false) ? 1 : 0,
    JSON.stringify(input.knowledge_gaps ?? []),
    JSON.stringify(input.action_items ?? []),
    (input.was_overconfident ?? false) ? 1 : 0,
    (input.was_underconfident ?? false) ? 1 : 0,
    JSON.stringify(input.related_error_ids ?? []),
    input.severity ?? 3,
  ]);
  
  saveDatabase();
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getErrorLogById(id)!;
}

export function getErrorLogById(id: number): ErrorLog | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM error_logs WHERE id = ?', [id]);
  return row ? parseErrorLog(row) : null;
}

export function getErrorLogByAttemptId(attemptId: number): ErrorLog | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM error_logs WHERE attempt_id = ?', [attemptId]);
  return row ? parseErrorLog(row) : null;
}

export function getErrorLogsByType(errorTypeCode: string): ErrorLog[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM error_logs WHERE error_type_code = ? ORDER BY created_at DESC',
    [errorTypeCode]
  );
  return rows.map(parseErrorLog);
}

export function getUnresolvedErrorLogs(): ErrorLog[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM error_logs WHERE is_resolved = 0 ORDER BY severity DESC, created_at DESC'
  );
  return rows.map(parseErrorLog);
}

export function getRecentErrorLogs(limit: number = 50): ErrorLog[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(parseErrorLog);
}

export function resolveErrorLog(id: number, resolutionNotes?: string): void {
  const db = getDatabase();
  db.run(`
    UPDATE error_logs SET 
      is_resolved = 1,
      resolution_notes = ?,
      resolved_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `, [resolutionNotes ?? null, id]);
  saveDatabase();
}

export function updateErrorLog(id: number, updates: Partial<ErrorLogCreateInput>): void {
  const db = getDatabase();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  
  if (updates.root_cause !== undefined) {
    sets.push('root_cause = ?');
    params.push(updates.root_cause);
  }
  if (updates.user_reasoning !== undefined) {
    sets.push('user_reasoning = ?');
    params.push(updates.user_reasoning);
  }
  if (updates.correct_reasoning !== undefined) {
    sets.push('correct_reasoning = ?');
    params.push(updates.correct_reasoning);
  }
  if (updates.knowledge_gaps !== undefined) {
    sets.push('knowledge_gaps = ?');
    params.push(JSON.stringify(updates.knowledge_gaps));
  }
  if (updates.action_items !== undefined) {
    sets.push('action_items = ?');
    params.push(JSON.stringify(updates.action_items));
  }
  if (updates.severity !== undefined) {
    sets.push('severity = ?');
    params.push(updates.severity);
  }
  
  if (sets.length === 0) return;
  
  sets.push("updated_at = datetime('now')");
  params.push(id);
  
  db.run(`UPDATE error_logs SET ${sets.join(', ')} WHERE id = ?`, params);
  saveDatabase();
}

// ============================================
// Error-Atom Association Functions
// ============================================

export function linkErrorToAtom(errorLogId: number, atomId: number, isPrimaryGap: boolean = false): void {
  const db = getDatabase();
  db.run(
    'INSERT OR IGNORE INTO error_atoms (error_log_id, atom_id, is_primary_gap) VALUES (?, ?, ?)',
    [errorLogId, atomId, isPrimaryGap ? 1 : 0]
  );
  saveDatabase();
}

export function getErrorAtoms(errorLogId: number): ErrorAtom[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM error_atoms WHERE error_log_id = ?',
    [errorLogId]
  );
  return rows.map(row => ({
    id: row.id as number,
    error_log_id: row.error_log_id as number,
    atom_id: row.atom_id as number,
    is_primary_gap: row.is_primary_gap === 1,
    created_at: row.created_at as string,
  }));
}

export function getErrorsByAtom(atomId: number): ErrorLog[] {
  const rows = query<Record<string, unknown>>(
    `SELECT el.* FROM error_logs el
     INNER JOIN error_atoms ea ON el.id = ea.error_log_id
     WHERE ea.atom_id = ?
     ORDER BY el.created_at DESC`,
    [atomId]
  );
  return rows.map(parseErrorLog);
}

// ============================================
// Error Pattern Functions
// ============================================

export function getAllErrorPatterns(): ErrorPattern[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM error_patterns WHERE is_active = 1 ORDER BY occurrence_count DESC'
  );
  return rows.map(parseErrorPattern);
}

export function getErrorPatternById(id: number): ErrorPattern | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM error_patterns WHERE id = ?', [id]);
  return row ? parseErrorPattern(row) : null;
}

export function incrementPatternOccurrence(patternId: number, errorLogId: number): void {
  const db = getDatabase();
  
  // Update pattern
  db.run(`
    UPDATE error_patterns SET 
      occurrence_count = occurrence_count + 1,
      last_occurrence = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `, [patternId]);
  
  // Link to error log
  db.run(
    'INSERT INTO error_pattern_instances (pattern_id, error_log_id) VALUES (?, ?)',
    [patternId, errorLogId]
  );
  
  saveDatabase();
}

// ============================================
// Statistics Functions
// ============================================

export function getErrorStatsByCategory(): Record<ErrorCategory, number> {
  const rows = query<{ category: ErrorCategory; count: number }>(`
    SELECT etd.category, COUNT(*) as count
    FROM error_logs el
    INNER JOIN error_type_definitions etd ON el.error_type_code = etd.code
    GROUP BY etd.category
  `);
  
  const stats: Record<ErrorCategory, number> = {
    conceptual: 0,
    computational: 0,
    reading: 0,
    strategy: 0,
    timing: 0,
    careless: 0,
  };
  
  for (const row of rows) {
    stats[row.category] = row.count;
  }
  
  return stats;
}

export function getMostCommonErrorTypes(limit: number = 10): Array<{ code: string; name: string; count: number }> {
  return query<{ code: string; name: string; count: number }>(`
    SELECT etd.code, etd.name, COUNT(*) as count
    FROM error_logs el
    INNER JOIN error_type_definitions etd ON el.error_type_code = etd.code
    GROUP BY el.error_type_code
    ORDER BY count DESC
    LIMIT ?
  `, [limit]);
}

export function getErrorTrend(days: number = 30): Array<{ date: string; count: number }> {
  return query<{ date: string; count: number }>(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM error_logs
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date
  `, [days]);
}

export function getTrapSuccumbRate(): number {
  const row = queryOne<{ total: number; fell: number }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN fell_for_trap = 1 THEN 1 ELSE 0 END) as fell
    FROM error_logs
    WHERE trap_archetype_code IS NOT NULL
  `);
  
  if (!row || row.total === 0) return 0;
  return row.fell / row.total;
}

export function getConfidenceCalibration(): { overconfident: number; underconfident: number; calibrated: number } {
  const row = queryOne<{ total: number; over: number; under: number }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN was_overconfident = 1 THEN 1 ELSE 0 END) as over,
      SUM(CASE WHEN was_underconfident = 1 THEN 1 ELSE 0 END) as under
    FROM error_logs
  `);
  
  if (!row || row.total === 0) {
    return { overconfident: 0, underconfident: 0, calibrated: 0 };
  }
  
  return {
    overconfident: row.over / row.total,
    underconfident: row.under / row.total,
    calibrated: (row.total - row.over - row.under) / row.total,
  };
}
