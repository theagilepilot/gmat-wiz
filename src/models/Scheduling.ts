/**
 * Scheduling Model
 * Training blocks, spaced repetition queue, mastery gates, and daily goals
 */

import { getDatabase, query, queryOne, saveDatabase } from '../db/connection.js';

// ============================================
// Types
// ============================================

export type BlockType = 'skill_build' | 'timed_drill' | 'review' | 'diagnostic' | 'mixed' | 'custom';
export type BlockStatus = 'pending' | 'active' | 'completed' | 'abandoned';
export type ReviewItemType = 'question' | 'atom' | 'error';
export type GateType = 'atom' | 'topic' | 'subtopic' | 'section' | 'difficulty_tier';

export interface TrainingBlock {
  id: number;
  name: string;
  block_type: BlockType;
  section_code: string | null;
  question_count: number;
  time_limit_seconds: number | null;
  difficulty_target: number | null;
  target_atoms: number[];
  status: BlockStatus;
  questions_answered: number;
  questions_correct: number;
  started_at: string | null;
  completed_at: string | null;
  time_spent_seconds: number;
  scheduled_for: string | null;
  priority: number;
  session_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingBlockCreateInput {
  name: string;
  block_type: BlockType;
  section_code?: string;
  question_count?: number;
  time_limit_seconds?: number;
  difficulty_target?: number;
  target_atoms?: number[];
  scheduled_for?: string;
  priority?: number;
  session_id?: number;
}

export interface ReviewQueueItem {
  id: number;
  item_type: ReviewItemType;
  item_id: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  last_quality: number | null;
  next_review_date: string;
  last_reviewed_at: string | null;
  priority: number;
  is_overdue: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  suspend_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MasteryGate {
  id: number;
  gate_type: GateType;
  unlocks_code: string;
  requirements: GateRequirements;
  is_unlocked: boolean;
  unlocked_at: string | null;
  progress_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GateRequirements {
  atoms_mastered?: string[];
  min_accuracy?: number;
  min_attempts?: number;
  min_elo?: number;
  prerequisites?: string[];
}

export interface DailyGoal {
  id: number;
  date: string;
  target_questions: number;
  target_minutes: number;
  target_accuracy: number;
  target_new_atoms: number;
  questions_done: number;
  minutes_studied: number;
  accuracy_achieved: number;
  new_atoms_learned: number;
  xp_earned: number;
  goals_met: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyPlanTemplate {
  id: number;
  name: string;
  description: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  minutes_per_session: number;
  weekly_structure: WeekStructure[];
  target_score: number | null;
  target_percentile: number | null;
  is_active: boolean;
  created_at: string;
}

export interface WeekStructure {
  week: number;
  focus: string;
  sections: string[];
  goal: string;
}

export interface ActiveStudyPlan {
  id: number;
  template_id: number | null;
  start_date: string;
  end_date: string;
  custom_structure: WeekStructure[] | null;
  current_week: number;
  current_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Helper Functions
// ============================================

function parseTrainingBlock(row: Record<string, unknown>): TrainingBlock {
  return {
    id: row.id as number,
    name: row.name as string,
    block_type: row.block_type as BlockType,
    section_code: row.section_code as string | null,
    question_count: row.question_count as number,
    time_limit_seconds: row.time_limit_seconds as number | null,
    difficulty_target: row.difficulty_target as number | null,
    target_atoms: JSON.parse(row.target_atoms as string || '[]'),
    status: row.status as BlockStatus,
    questions_answered: row.questions_answered as number,
    questions_correct: row.questions_correct as number,
    started_at: row.started_at as string | null,
    completed_at: row.completed_at as string | null,
    time_spent_seconds: row.time_spent_seconds as number,
    scheduled_for: row.scheduled_for as string | null,
    priority: row.priority as number,
    session_id: row.session_id as number | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseReviewQueueItem(row: Record<string, unknown>): ReviewQueueItem {
  return {
    id: row.id as number,
    item_type: row.item_type as ReviewItemType,
    item_id: row.item_id as number,
    ease_factor: row.ease_factor as number,
    interval_days: row.interval_days as number,
    repetitions: row.repetitions as number,
    last_quality: row.last_quality as number | null,
    next_review_date: row.next_review_date as string,
    last_reviewed_at: row.last_reviewed_at as string | null,
    priority: row.priority as number,
    is_overdue: row.is_overdue === 1,
    is_suspended: row.is_suspended === 1,
    suspended_until: row.suspended_until as string | null,
    suspend_reason: row.suspend_reason as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseMasteryGate(row: Record<string, unknown>): MasteryGate {
  return {
    id: row.id as number,
    gate_type: row.gate_type as GateType,
    unlocks_code: row.unlocks_code as string,
    requirements: JSON.parse(row.requirements as string || '{}'),
    is_unlocked: row.is_unlocked === 1,
    unlocked_at: row.unlocked_at as string | null,
    progress_json: JSON.parse(row.progress_json as string || '{}'),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseDailyGoal(row: Record<string, unknown>): DailyGoal {
  return {
    id: row.id as number,
    date: row.date as string,
    target_questions: row.target_questions as number,
    target_minutes: row.target_minutes as number,
    target_accuracy: row.target_accuracy as number,
    target_new_atoms: row.target_new_atoms as number,
    questions_done: row.questions_done as number,
    minutes_studied: row.minutes_studied as number,
    accuracy_achieved: row.accuracy_achieved as number,
    new_atoms_learned: row.new_atoms_learned as number,
    xp_earned: row.xp_earned as number,
    goals_met: row.goals_met as number,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseStudyPlanTemplate(row: Record<string, unknown>): StudyPlanTemplate {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string | null,
    duration_weeks: row.duration_weeks as number,
    sessions_per_week: row.sessions_per_week as number,
    minutes_per_session: row.minutes_per_session as number,
    weekly_structure: JSON.parse(row.weekly_structure as string || '[]'),
    target_score: row.target_score as number | null,
    target_percentile: row.target_percentile as number | null,
    is_active: row.is_active === 1,
    created_at: row.created_at as string,
  };
}

// ============================================
// Training Block Functions
// ============================================

export function createTrainingBlock(input: TrainingBlockCreateInput): TrainingBlock {
  const db = getDatabase();
  
  db.run(`
    INSERT INTO training_blocks (
      name, block_type, section_code, question_count,
      time_limit_seconds, difficulty_target, target_atoms,
      scheduled_for, priority, session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.name,
    input.block_type,
    input.section_code ?? null,
    input.question_count ?? 10,
    input.time_limit_seconds ?? null,
    input.difficulty_target ?? null,
    JSON.stringify(input.target_atoms ?? []),
    input.scheduled_for ?? null,
    input.priority ?? 5,
    input.session_id ?? null,
  ]);
  
  saveDatabase();
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getTrainingBlockById(id)!;
}

export function getTrainingBlockById(id: number): TrainingBlock | null {
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM training_blocks WHERE id = ?',
    [id]
  );
  return row ? parseTrainingBlock(row) : null;
}

export function getPendingBlocks(): TrainingBlock[] {
  const rows = query<Record<string, unknown>>(
    "SELECT * FROM training_blocks WHERE status = 'pending' ORDER BY priority DESC, scheduled_for"
  );
  return rows.map(parseTrainingBlock);
}

export function getActiveBlock(): TrainingBlock | null {
  const row = queryOne<Record<string, unknown>>(
    "SELECT * FROM training_blocks WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
  );
  return row ? parseTrainingBlock(row) : null;
}

export function startBlock(blockId: number): TrainingBlock {
  const db = getDatabase();
  db.run(`
    UPDATE training_blocks SET
      status = 'active',
      started_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `, [blockId]);
  saveDatabase();
  return getTrainingBlockById(blockId)!;
}

export function recordBlockProgress(blockId: number, wasCorrect: boolean, timeSeconds: number): void {
  const db = getDatabase();
  db.run(`
    UPDATE training_blocks SET
      questions_answered = questions_answered + 1,
      questions_correct = questions_correct + ?,
      time_spent_seconds = time_spent_seconds + ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [wasCorrect ? 1 : 0, timeSeconds, blockId]);
  saveDatabase();
}

export function completeBlock(blockId: number): TrainingBlock {
  const db = getDatabase();
  db.run(`
    UPDATE training_blocks SET
      status = 'completed',
      completed_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `, [blockId]);
  saveDatabase();
  return getTrainingBlockById(blockId)!;
}

export function abandonBlock(blockId: number): void {
  const db = getDatabase();
  db.run(`
    UPDATE training_blocks SET
      status = 'abandoned',
      updated_at = datetime('now')
    WHERE id = ?
  `, [blockId]);
  saveDatabase();
}

export function getCompletedBlocks(limit: number = 50): TrainingBlock[] {
  const rows = query<Record<string, unknown>>(
    "SELECT * FROM training_blocks WHERE status = 'completed' ORDER BY completed_at DESC LIMIT ?",
    [limit]
  );
  return rows.map(parseTrainingBlock);
}

// ============================================
// Review Queue Functions (SM-2 Spaced Repetition)
// ============================================

export function addToReviewQueue(
  itemType: ReviewItemType,
  itemId: number,
  priority: number = 5
): ReviewQueueItem {
  const db = getDatabase();
  
  // Check if already exists
  const existing = queryOne<Record<string, unknown>>(
    'SELECT * FROM review_queue WHERE item_type = ? AND item_id = ?',
    [itemType, itemId]
  );
  
  if (existing) {
    return parseReviewQueueItem(existing);
  }
  
  const nextReviewDate = new Date().toISOString().split('T')[0];
  
  db.run(`
    INSERT INTO review_queue (item_type, item_id, priority, next_review_date)
    VALUES (?, ?, ?, ?)
  `, [itemType, itemId, priority, nextReviewDate]);
  
  saveDatabase();
  
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM review_queue WHERE item_type = ? AND item_id = ?',
    [itemType, itemId]
  );
  return parseReviewQueueItem(row!);
}

export function getDueReviews(limit: number = 20): ReviewQueueItem[] {
  const today = new Date().toISOString().split('T')[0];
  
  const rows = query<Record<string, unknown>>(`
    SELECT * FROM review_queue 
    WHERE next_review_date <= ? 
    AND is_suspended = 0
    ORDER BY is_overdue DESC, priority DESC, next_review_date
    LIMIT ?
  `, [today, limit]);
  
  return rows.map(parseReviewQueueItem);
}

/**
 * Update review item using SM-2 algorithm
 * @param itemId Review queue item ID
 * @param quality Quality of recall (0-5): 0-2 = fail, 3 = hard, 4 = good, 5 = easy
 */
export function processReview(itemId: number, quality: number): ReviewQueueItem {
  const db = getDatabase();
  
  const item = queryOne<Record<string, unknown>>(
    'SELECT * FROM review_queue WHERE id = ?',
    [itemId]
  );
  if (!item) throw new Error('Review item not found');
  
  const current = parseReviewQueueItem(item);
  
  // SM-2 Algorithm
  let easeFactor = current.ease_factor;
  let interval = current.interval_days;
  let repetitions = current.repetitions;
  
  if (quality < 3) {
    // Failed - reset
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }
  
  // Update ease factor
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  const nextReviewDate = nextDate.toISOString().split('T')[0];
  
  db.run(`
    UPDATE review_queue SET
      ease_factor = ?,
      interval_days = ?,
      repetitions = ?,
      last_quality = ?,
      next_review_date = ?,
      last_reviewed_at = datetime('now'),
      is_overdue = 0,
      updated_at = datetime('now')
    WHERE id = ?
  `, [easeFactor, interval, repetitions, quality, nextReviewDate, itemId]);
  
  saveDatabase();
  
  return getReviewQueueItemById(itemId)!;
}

export function getReviewQueueItemById(id: number): ReviewQueueItem | null {
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM review_queue WHERE id = ?',
    [id]
  );
  return row ? parseReviewQueueItem(row) : null;
}

export function suspendReviewItem(id: number, reason?: string, until?: string): void {
  const db = getDatabase();
  db.run(`
    UPDATE review_queue SET
      is_suspended = 1,
      suspend_reason = ?,
      suspended_until = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [reason ?? null, until ?? null, id]);
  saveDatabase();
}

export function unsuspendReviewItem(id: number): void {
  const db = getDatabase();
  db.run(`
    UPDATE review_queue SET
      is_suspended = 0,
      suspend_reason = NULL,
      suspended_until = NULL,
      updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
  saveDatabase();
}

export function markOverdueItems(): number {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  db.run(`
    UPDATE review_queue SET
      is_overdue = 1,
      updated_at = datetime('now')
    WHERE next_review_date < ? AND is_suspended = 0 AND is_overdue = 0
  `, [today]);
  
  saveDatabase();
  
  const result = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM review_queue WHERE is_overdue = 1');
  return result?.count ?? 0;
}

// ============================================
// Mastery Gate Functions
// ============================================

export function getMasteryGate(gateType: GateType, unlocksCode: string): MasteryGate | null {
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM mastery_gates WHERE gate_type = ? AND unlocks_code = ?',
    [gateType, unlocksCode]
  );
  return row ? parseMasteryGate(row) : null;
}

export function createMasteryGate(
  gateType: GateType,
  unlocksCode: string,
  requirements: GateRequirements
): MasteryGate {
  const db = getDatabase();
  
  db.run(`
    INSERT OR REPLACE INTO mastery_gates (gate_type, unlocks_code, requirements)
    VALUES (?, ?, ?)
  `, [gateType, unlocksCode, JSON.stringify(requirements)]);
  
  saveDatabase();
  
  return getMasteryGate(gateType, unlocksCode)!;
}

export function checkAndUnlockGate(gateType: GateType, unlocksCode: string): boolean {
  const gate = getMasteryGate(gateType, unlocksCode);
  if (!gate || gate.is_unlocked) return gate?.is_unlocked ?? false;
  
  // TODO: Implement actual gate checking logic based on requirements
  // This would check mastered atoms, accuracy, attempts, ELO, etc.
  
  return false;
}

export function unlockGate(gateType: GateType, unlocksCode: string): void {
  const db = getDatabase();
  db.run(`
    UPDATE mastery_gates SET
      is_unlocked = 1,
      unlocked_at = datetime('now'),
      updated_at = datetime('now')
    WHERE gate_type = ? AND unlocks_code = ?
  `, [gateType, unlocksCode]);
  saveDatabase();
}

export function getUnlockedGates(): MasteryGate[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM mastery_gates WHERE is_unlocked = 1'
  );
  return rows.map(parseMasteryGate);
}

export function getLockedGates(): MasteryGate[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM mastery_gates WHERE is_unlocked = 0'
  );
  return rows.map(parseMasteryGate);
}

// ============================================
// Daily Goals Functions
// ============================================

export function getTodayGoals(): DailyGoal {
  const today = new Date().toISOString().split('T')[0];
  return getOrCreateDailyGoal(today);
}

export function getOrCreateDailyGoal(date: string): DailyGoal {
  const db = getDatabase();
  
  let row = queryOne<Record<string, unknown>>(
    'SELECT * FROM daily_goals WHERE date = ?',
    [date]
  );
  
  if (!row) {
    db.run('INSERT INTO daily_goals (date) VALUES (?)', [date]);
    saveDatabase();
    row = queryOne<Record<string, unknown>>(
      'SELECT * FROM daily_goals WHERE date = ?',
      [date]
    );
  }
  
  return parseDailyGoal(row!);
}

export function updateDailyProgress(
  questionsAdd: number = 0,
  minutesAdd: number = 0,
  correctQuestions: number = 0,
  totalQuestions: number = 0,
  newAtomsAdd: number = 0,
  xpAdd: number = 0
): DailyGoal {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const goal = getOrCreateDailyGoal(today);
  
  const newQuestionsTotal = goal.questions_done + questionsAdd;
  const totalCorrect = Math.round(goal.accuracy_achieved * goal.questions_done) + correctQuestions;
  const newAccuracy = newQuestionsTotal > 0 ? totalCorrect / newQuestionsTotal : 0;
  
  // Count goals met
  let goalsMet = 0;
  const newMinutes = goal.minutes_studied + minutesAdd;
  const newAtoms = goal.new_atoms_learned + newAtomsAdd;
  
  if (newQuestionsTotal >= goal.target_questions) goalsMet++;
  if (newMinutes >= goal.target_minutes) goalsMet++;
  if (newAccuracy >= goal.target_accuracy) goalsMet++;
  if (newAtoms >= goal.target_new_atoms) goalsMet++;
  
  db.run(`
    UPDATE daily_goals SET
      questions_done = ?,
      minutes_studied = ?,
      accuracy_achieved = ?,
      new_atoms_learned = ?,
      xp_earned = xp_earned + ?,
      goals_met = ?,
      updated_at = datetime('now')
    WHERE date = ?
  `, [
    newQuestionsTotal,
    newMinutes,
    newAccuracy,
    newAtoms,
    xpAdd,
    goalsMet,
    today,
  ]);
  
  saveDatabase();
  
  return getTodayGoals();
}

export function getDailyGoalHistory(days: number = 30): DailyGoal[] {
  const rows = query<Record<string, unknown>>(`
    SELECT * FROM daily_goals 
    ORDER BY date DESC 
    LIMIT ?
  `, [days]);
  return rows.map(parseDailyGoal);
}

export function getStreak(): number {
  const rows = query<{ date: string; goals_met: number }>(`
    SELECT date, goals_met FROM daily_goals 
    ORDER BY date DESC 
    LIMIT 365
  `);
  
  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < rows.length; i++) {
    const goalDate = new Date(rows[i].date);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    
    // Check if this is the expected consecutive day
    if (goalDate.toISOString().split('T')[0] !== expectedDate.toISOString().split('T')[0]) {
      break;
    }
    
    // Check if at least one goal was met
    if (rows[i].goals_met > 0) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// ============================================
// Study Plan Functions
// ============================================

export function getStudyPlanTemplates(): StudyPlanTemplate[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM study_plan_templates WHERE is_active = 1'
  );
  return rows.map(parseStudyPlanTemplate);
}

export function getStudyPlanTemplateById(id: number): StudyPlanTemplate | null {
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM study_plan_templates WHERE id = ?',
    [id]
  );
  return row ? parseStudyPlanTemplate(row) : null;
}

export function getActiveStudyPlan(): ActiveStudyPlan | null {
  const row = queryOne<Record<string, unknown>>(
    'SELECT * FROM active_study_plan WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  );
  if (!row) return null;
  
  return {
    id: row.id as number,
    template_id: row.template_id as number | null,
    start_date: row.start_date as string,
    end_date: row.end_date as string,
    custom_structure: row.custom_structure ? JSON.parse(row.custom_structure as string) : null,
    current_week: row.current_week as number,
    current_day: row.current_day as number,
    is_active: row.is_active === 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function startStudyPlan(templateId: number, startDate?: string): ActiveStudyPlan {
  const db = getDatabase();
  const template = getStudyPlanTemplateById(templateId);
  if (!template) throw new Error('Template not found');
  
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + template.duration_weeks * 7);
  
  // Deactivate any existing plans
  db.run('UPDATE active_study_plan SET is_active = 0');
  
  db.run(`
    INSERT INTO active_study_plan (template_id, start_date, end_date)
    VALUES (?, ?, ?)
  `, [
    templateId,
    start.toISOString().split('T')[0],
    end.toISOString().split('T')[0],
  ]);
  
  saveDatabase();
  
  return getActiveStudyPlan()!;
}

export function advanceStudyPlan(): void {
  const db = getDatabase();
  const plan = getActiveStudyPlan();
  if (!plan) return;
  
  const template = plan.template_id ? getStudyPlanTemplateById(plan.template_id) : null;
  const sessionsPerWeek = template?.sessions_per_week ?? 5;
  
  let newDay = plan.current_day + 1;
  let newWeek = plan.current_week;
  
  if (newDay > sessionsPerWeek) {
    newDay = 1;
    newWeek++;
  }
  
  db.run(`
    UPDATE active_study_plan SET
      current_week = ?,
      current_day = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [newWeek, newDay, plan.id]);
  
  saveDatabase();
}
