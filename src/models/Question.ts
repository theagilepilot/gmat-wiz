/**
 * Question Model
 * Represents GMAT questions and user attempts
 */

import { getDatabase, query, queryOne, execute, saveDatabase } from '../db/connection.js';

// ============================================
// Types
// ============================================

export type QuestionSource = 'seeded' | 'ai_generated' | 'user_created' | 'official';
export type FeedbackType = 'quality' | 'difficulty' | 'clarity' | 'error' | 'duplicate';

export interface Question {
  id: number;
  external_id: string | null;
  source: QuestionSource;
  section_code: string;
  question_type_code: string;
  stem: string;
  answer_choices: string[] | null;
  correct_answer: string;
  explanation: string | null;
  statement_1: string | null;
  statement_2: string | null;
  difficulty_rating: number;
  estimated_time_seconds: number;
  tags: string[];
  ai_model: string | null;
  ai_prompt_hash: string | null;
  generation_params: Record<string, unknown> | null;
  quality_score: number | null;
  times_served: number;
  times_correct: number;
  avg_time_taken: number | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionCreateInput {
  external_id?: string;
  source: QuestionSource;
  section_code: string;
  question_type_code: string;
  stem: string;
  answer_choices?: string[];
  correct_answer: string;
  explanation?: string;
  statement_1?: string;
  statement_2?: string;
  difficulty_rating?: number;
  estimated_time_seconds?: number;
  tags?: string[];
  ai_model?: string;
  ai_prompt_hash?: string;
  generation_params?: Record<string, unknown>;
}

export interface Attempt {
  id: number;
  question_id: number;
  session_id: number | null;
  training_block_id: number | null;
  user_answer: string;
  is_correct: boolean;
  time_started: string;
  time_submitted: string;
  time_taken_seconds: number;
  was_overtime: boolean;
  user_elo_at_attempt: number;
  question_difficulty_at_attempt: number;
  confidence_before: number | null;
  confidence_after: number | null;
  method_code: string | null;
  method_was_optimal: boolean | null;
  was_guessed: boolean;
  marked_for_review: boolean;
  user_notes: string | null;
  created_at: string;
}

export interface AttemptCreateInput {
  question_id: number;
  session_id?: number;
  training_block_id?: number;
  user_answer: string;
  is_correct: boolean;
  time_started: string;
  time_submitted: string;
  time_taken_seconds: number;
  was_overtime?: boolean;
  user_elo_at_attempt: number;
  question_difficulty_at_attempt: number;
  confidence_before?: number;
  confidence_after?: number;
  method_code?: string;
  method_was_optimal?: boolean;
  was_guessed?: boolean;
  marked_for_review?: boolean;
  user_notes?: string;
}

export interface QuestionAtom {
  id: number;
  question_id: number;
  atom_id: number;
  is_primary: boolean;
  created_at: string;
}

export interface QuestionFeedback {
  id: number;
  question_id: number;
  feedback_type: FeedbackType;
  rating: number | null;
  comment: string | null;
  created_at: string;
}

// ============================================
// Helper Functions
// ============================================

function parseQuestion(row: Record<string, unknown>): Question {
  return {
    id: row.id as number,
    external_id: row.external_id as string | null,
    source: row.source as QuestionSource,
    section_code: row.section_code as string,
    question_type_code: row.question_type_code as string,
    stem: row.stem as string,
    answer_choices: row.answer_choices ? JSON.parse(row.answer_choices as string) : null,
    correct_answer: row.correct_answer as string,
    explanation: row.explanation as string | null,
    statement_1: row.statement_1 as string | null,
    statement_2: row.statement_2 as string | null,
    difficulty_rating: row.difficulty_rating as number,
    estimated_time_seconds: row.estimated_time_seconds as number,
    tags: JSON.parse(row.tags as string || '[]'),
    ai_model: row.ai_model as string | null,
    ai_prompt_hash: row.ai_prompt_hash as string | null,
    generation_params: row.generation_params ? JSON.parse(row.generation_params as string) : null,
    quality_score: row.quality_score as number | null,
    times_served: row.times_served as number,
    times_correct: row.times_correct as number,
    avg_time_taken: row.avg_time_taken as number | null,
    is_active: row.is_active === 1,
    is_verified: row.is_verified === 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseAttempt(row: Record<string, unknown>): Attempt {
  return {
    id: row.id as number,
    question_id: row.question_id as number,
    session_id: row.session_id as number | null,
    training_block_id: row.training_block_id as number | null,
    user_answer: row.user_answer as string,
    is_correct: row.is_correct === 1,
    time_started: row.time_started as string,
    time_submitted: row.time_submitted as string,
    time_taken_seconds: row.time_taken_seconds as number,
    was_overtime: row.was_overtime === 1,
    user_elo_at_attempt: row.user_elo_at_attempt as number,
    question_difficulty_at_attempt: row.question_difficulty_at_attempt as number,
    confidence_before: row.confidence_before as number | null,
    confidence_after: row.confidence_after as number | null,
    method_code: row.method_code as string | null,
    method_was_optimal: row.method_was_optimal === null ? null : row.method_was_optimal === 1,
    was_guessed: row.was_guessed === 1,
    marked_for_review: row.marked_for_review === 1,
    user_notes: row.user_notes as string | null,
    created_at: row.created_at as string,
  };
}

// ============================================
// Question Functions
// ============================================

export function createQuestion(input: QuestionCreateInput): Question {
  const db = getDatabase();
  
  db.run(`
    INSERT INTO questions (
      external_id, source, section_code, question_type_code,
      stem, answer_choices, correct_answer, explanation,
      statement_1, statement_2, difficulty_rating, estimated_time_seconds,
      tags, ai_model, ai_prompt_hash, generation_params
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.external_id ?? null,
    input.source,
    input.section_code,
    input.question_type_code,
    input.stem,
    input.answer_choices ? JSON.stringify(input.answer_choices) : null,
    input.correct_answer,
    input.explanation ?? null,
    input.statement_1 ?? null,
    input.statement_2 ?? null,
    input.difficulty_rating ?? 500,
    input.estimated_time_seconds ?? 120,
    JSON.stringify(input.tags ?? []),
    input.ai_model ?? null,
    input.ai_prompt_hash ?? null,
    input.generation_params ? JSON.stringify(input.generation_params) : null,
  ]);
  
  saveDatabase();
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getQuestionById(id)!;
}

export function getQuestionById(id: number): Question | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM questions WHERE id = ?', [id]);
  return row ? parseQuestion(row) : null;
}

export function getQuestionByExternalId(externalId: string): Question | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM questions WHERE external_id = ?', [externalId]);
  return row ? parseQuestion(row) : null;
}

export function getQuestionsBySection(sectionCode: string, limit: number = 50): Question[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM questions WHERE section_code = ? AND is_active = 1 ORDER BY difficulty_rating LIMIT ?',
    [sectionCode, limit]
  );
  return rows.map(parseQuestion);
}

export function getQuestionsByAtom(atomId: number): Question[] {
  const rows = query<Record<string, unknown>>(
    `SELECT q.* FROM questions q
     INNER JOIN question_atoms qa ON q.id = qa.question_id
     WHERE qa.atom_id = ? AND q.is_active = 1`,
    [atomId]
  );
  return rows.map(parseQuestion);
}

export function getQuestionsForDifficulty(
  sectionCode: string,
  minDifficulty: number,
  maxDifficulty: number,
  limit: number = 10
): Question[] {
  const rows = query<Record<string, unknown>>(
    `SELECT * FROM questions 
     WHERE section_code = ? 
     AND difficulty_rating BETWEEN ? AND ?
     AND is_active = 1
     ORDER BY RANDOM()
     LIMIT ?`,
    [sectionCode, minDifficulty, maxDifficulty, limit]
  );
  return rows.map(parseQuestion);
}

export function getUnattemptedQuestions(
  sectionCode: string,
  limit: number = 10
): Question[] {
  const rows = query<Record<string, unknown>>(
    `SELECT q.* FROM questions q
     WHERE q.section_code = ?
     AND q.is_active = 1
     AND q.id NOT IN (SELECT DISTINCT question_id FROM attempts)
     ORDER BY q.difficulty_rating
     LIMIT ?`,
    [sectionCode, limit]
  );
  return rows.map(parseQuestion);
}

export function updateQuestionStats(questionId: number, isCorrect: boolean, timeTaken: number): void {
  const db = getDatabase();
  
  // Get current stats
  const question = getQuestionById(questionId);
  if (!question) return;
  
  const newTimesServed = question.times_served + 1;
  const newTimesCorrect = question.times_correct + (isCorrect ? 1 : 0);
  const newAvgTime = question.avg_time_taken === null
    ? timeTaken
    : (question.avg_time_taken * question.times_served + timeTaken) / newTimesServed;
  
  db.run(`
    UPDATE questions SET 
      times_served = ?,
      times_correct = ?,
      avg_time_taken = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [newTimesServed, newTimesCorrect, newAvgTime, questionId]);
  
  saveDatabase();
}

export function linkQuestionToAtom(questionId: number, atomId: number, isPrimary: boolean = false): void {
  const db = getDatabase();
  db.run(
    'INSERT OR IGNORE INTO question_atoms (question_id, atom_id, is_primary) VALUES (?, ?, ?)',
    [questionId, atomId, isPrimary ? 1 : 0]
  );
  saveDatabase();
}

export function getQuestionAtoms(questionId: number): number[] {
  const rows = query<{ atom_id: number }>(
    'SELECT atom_id FROM question_atoms WHERE question_id = ?',
    [questionId]
  );
  return rows.map(r => r.atom_id);
}

// ============================================
// Attempt Functions
// ============================================

export function createAttempt(input: AttemptCreateInput): Attempt {
  const db = getDatabase();
  
  db.run(`
    INSERT INTO attempts (
      question_id, session_id, training_block_id,
      user_answer, is_correct, time_started, time_submitted,
      time_taken_seconds, was_overtime, user_elo_at_attempt,
      question_difficulty_at_attempt, confidence_before, confidence_after,
      method_code, method_was_optimal, was_guessed, marked_for_review, user_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.question_id,
    input.session_id ?? null,
    input.training_block_id ?? null,
    input.user_answer,
    input.is_correct ? 1 : 0,
    input.time_started,
    input.time_submitted,
    input.time_taken_seconds,
    (input.was_overtime ?? false) ? 1 : 0,
    input.user_elo_at_attempt,
    input.question_difficulty_at_attempt,
    input.confidence_before ?? null,
    input.confidence_after ?? null,
    input.method_code ?? null,
    input.method_was_optimal === undefined ? null : (input.method_was_optimal ? 1 : 0),
    (input.was_guessed ?? false) ? 1 : 0,
    (input.marked_for_review ?? false) ? 1 : 0,
    input.user_notes ?? null,
  ]);
  
  saveDatabase();
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getAttemptById(id)!;
}

export function getAttemptById(id: number): Attempt | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM attempts WHERE id = ?', [id]);
  return row ? parseAttempt(row) : null;
}

export function getAttemptsByQuestion(questionId: number): Attempt[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM attempts WHERE question_id = ? ORDER BY created_at DESC',
    [questionId]
  );
  return rows.map(parseAttempt);
}

export function getAttemptsBySession(sessionId: number): Attempt[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM attempts WHERE session_id = ? ORDER BY created_at',
    [sessionId]
  );
  return rows.map(parseAttempt);
}

export function getRecentAttempts(limit: number = 50): Attempt[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM attempts ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(parseAttempt);
}

export function getAttemptsByAtom(atomId: number): Attempt[] {
  const rows = query<Record<string, unknown>>(
    `SELECT a.* FROM attempts a
     INNER JOIN attempt_atoms aa ON a.id = aa.attempt_id
     WHERE aa.atom_id = ?
     ORDER BY a.created_at DESC`,
    [atomId]
  );
  return rows.map(parseAttempt);
}

export function linkAttemptToAtom(attemptId: number, atomId: number): void {
  const db = getDatabase();
  db.run(
    'INSERT OR IGNORE INTO attempt_atoms (attempt_id, atom_id) VALUES (?, ?)',
    [attemptId, atomId]
  );
  saveDatabase();
}

export function getIncorrectAttempts(limit: number = 50): Attempt[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM attempts WHERE is_correct = 0 ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(parseAttempt);
}

export function getMarkedForReview(): Attempt[] {
  const rows = query<Record<string, unknown>>(
    'SELECT * FROM attempts WHERE marked_for_review = 1 ORDER BY created_at DESC'
  );
  return rows.map(parseAttempt);
}

// ============================================
// Feedback Functions
// ============================================

export function addQuestionFeedback(
  questionId: number,
  feedbackType: FeedbackType,
  rating?: number,
  comment?: string
): QuestionFeedback {
  const db = getDatabase();
  
  db.run(
    'INSERT INTO question_feedback (question_id, feedback_type, rating, comment) VALUES (?, ?, ?, ?)',
    [questionId, feedbackType, rating ?? null, comment ?? null]
  );
  
  saveDatabase();
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  const row = queryOne<QuestionFeedback>('SELECT * FROM question_feedback WHERE id = ?', [id]);
  return row!;
}

export function getQuestionFeedback(questionId: number): QuestionFeedback[] {
  return query<QuestionFeedback>(
    'SELECT * FROM question_feedback WHERE question_id = ? ORDER BY created_at DESC',
    [questionId]
  );
}

// ============================================
// Statistics Functions
// ============================================

export function getAttemptStats(): {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  avgTime: number;
} {
  const row = queryOne<{
    total: number;
    correct: number;
    avg_time: number;
  }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
      AVG(time_taken_seconds) as avg_time
    FROM attempts
  `);
  
  const total = row?.total ?? 0;
  const correct = row?.correct ?? 0;
  
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy: total > 0 ? correct / total : 0,
    avgTime: row?.avg_time ?? 0,
  };
}

export function getAttemptStatsBySection(sectionCode: string): {
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
} {
  const row = queryOne<{
    total: number;
    correct: number;
    avg_time: number;
  }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct,
      AVG(a.time_taken_seconds) as avg_time
    FROM attempts a
    INNER JOIN questions q ON a.question_id = q.id
    WHERE q.section_code = ?
  `, [sectionCode]);
  
  const total = row?.total ?? 0;
  const correct = row?.correct ?? 0;
  
  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    avgTime: row?.avg_time ?? 0,
  };
}

export function getAttemptStatsByAtom(atomId: number): {
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
} {
  const row = queryOne<{
    total: number;
    correct: number;
    avg_time: number;
  }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct,
      AVG(a.time_taken_seconds) as avg_time
    FROM attempts a
    INNER JOIN attempt_atoms aa ON a.id = aa.attempt_id
    WHERE aa.atom_id = ?
  `, [atomId]);
  
  const total = row?.total ?? 0;
  const correct = row?.correct ?? 0;
  
  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    avgTime: row?.avg_time ?? 0,
  };
}
