/**
 * Skill Atom Model
 * Hierarchical taxonomy: Section -> Topic -> Subtopic -> Atom
 */

import { getDatabase, query, queryOne, saveDatabase } from '../db/connection.js';

// ============================================
// Types
// ============================================

export interface Section {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Topic {
  id: number;
  section_id: number;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Subtopic {
  id: number;
  topic_id: number;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Atom {
  id: number;
  subtopic_id: number;
  code: string;
  name: string;
  description: string | null;
  difficulty_tier: number; // 1-5
  is_foundational: boolean;
  sort_order: number;
  created_at: string;
}

// Raw database row type for Atom (before boolean conversion)
interface AtomRow {
  id: number;
  subtopic_id: number;
  code: string;
  name: string;
  description: string | null;
  difficulty_tier: number;
  is_foundational: number; // 0 or 1 in SQLite
  sort_order: number;
  created_at: string;
}

export interface QuestionType {
  id: number;
  section_id: number;
  code: string;
  name: string;
  description: string | null;
  time_budget_seconds: number;
  created_at: string;
}

export interface MethodArchetype {
  id: number;
  code: string;
  name: string;
  description: string | null;
  applicable_sections: string[];
  created_at: string;
}

export interface TrapArchetype {
  id: number;
  code: string;
  name: string;
  description: string | null;
  applicable_sections: string[];
  created_at: string;
}

export interface AtomWithPath {
  atom: Atom;
  subtopic: Subtopic;
  topic: Topic;
  section: Section;
  path: string; // e.g., "Quant > Algebra > Linear Equations > Two Variables"
}

// ============================================
// Helper Functions
// ============================================

function parseAtomRow(row: AtomRow): Atom {
  return {
    id: row.id,
    subtopic_id: row.subtopic_id,
    code: row.code,
    name: row.name,
    description: row.description,
    difficulty_tier: row.difficulty_tier,
    is_foundational: row.is_foundational === 1,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

// ============================================
// Section Functions
// ============================================

export function getAllSections(): Section[] {
  return query<Section>('SELECT * FROM sections ORDER BY sort_order');
}

export function getSectionByCode(code: string): Section | null {
  const row = queryOne<Section>('SELECT * FROM sections WHERE code = ?', [code]);
  return row ?? null;
}

export function getSectionById(id: number): Section | null {
  const row = queryOne<Section>('SELECT * FROM sections WHERE id = ?', [id]);
  return row ?? null;
}

// ============================================
// Topic Functions
// ============================================

export function getTopicsBySection(sectionId: number): Topic[] {
  return query<Topic>(
    'SELECT * FROM topics WHERE section_id = ? ORDER BY sort_order',
    [sectionId]
  );
}

export function getTopicByCode(code: string): Topic | null {
  const row = queryOne<Topic>('SELECT * FROM topics WHERE code = ?', [code]);
  return row ?? null;
}

export function getTopicById(id: number): Topic | null {
  const row = queryOne<Topic>('SELECT * FROM topics WHERE id = ?', [id]);
  return row ?? null;
}

// ============================================
// Subtopic Functions
// ============================================

export function getSubtopicsByTopic(topicId: number): Subtopic[] {
  return query<Subtopic>(
    'SELECT * FROM subtopics WHERE topic_id = ? ORDER BY sort_order',
    [topicId]
  );
}

export function getSubtopicByCode(code: string): Subtopic | null {
  const row = queryOne<Subtopic>('SELECT * FROM subtopics WHERE code = ?', [code]);
  return row ?? null;
}

export function getSubtopicById(id: number): Subtopic | null {
  const row = queryOne<Subtopic>('SELECT * FROM subtopics WHERE id = ?', [id]);
  return row ?? null;
}

// ============================================
// Atom Functions
// ============================================

export function getAtomsBySubtopic(subtopicId: number): Atom[] {
  const rows = query<AtomRow>(
    'SELECT * FROM atoms WHERE subtopic_id = ? ORDER BY sort_order',
    [subtopicId]
  );
  return rows.map(parseAtomRow);
}

export function getAtomByCode(code: string): Atom | null {
  const row = queryOne<AtomRow>('SELECT * FROM atoms WHERE code = ?', [code]);
  if (!row) return null;
  return parseAtomRow(row);
}

export function getAtomById(id: number): Atom | null {
  const row = queryOne<AtomRow>('SELECT * FROM atoms WHERE id = ?', [id]);
  if (!row) return null;
  return parseAtomRow(row);
}

export function getAtomsByDifficultyTier(tier: number): Atom[] {
  const rows = query<AtomRow>(
    'SELECT * FROM atoms WHERE difficulty_tier = ? ORDER BY subtopic_id, sort_order',
    [tier]
  );
  return rows.map(parseAtomRow);
}

export function getFoundationalAtoms(): Atom[] {
  const rows = query<AtomRow>(
    'SELECT * FROM atoms WHERE is_foundational = 1 ORDER BY subtopic_id, sort_order'
  );
  return rows.map(parseAtomRow);
}

export function getAtomWithPath(atomId: number): AtomWithPath | null {
  const atom = getAtomById(atomId);
  if (!atom) return null;
  
  const subtopic = getSubtopicById(atom.subtopic_id);
  if (!subtopic) return null;
  
  const topic = getTopicById(subtopic.topic_id);
  if (!topic) return null;
  
  const section = getSectionById(topic.section_id);
  if (!section) return null;
  
  return {
    atom,
    subtopic,
    topic,
    section,
    path: `${section.name} > ${topic.name} > ${subtopic.name} > ${atom.name}`,
  };
}

export function getAtomPrerequisites(atomId: number): Atom[] {
  const rows = query<AtomRow>(
    `SELECT a.* FROM atoms a
     INNER JOIN atom_prerequisites ap ON a.id = ap.prerequisite_atom_id
     WHERE ap.atom_id = ?`,
    [atomId]
  );
  return rows.map(parseAtomRow);
}

export function getAtomsDependingOn(atomId: number): Atom[] {
  const rows = query<AtomRow>(
    `SELECT a.* FROM atoms a
     INNER JOIN atom_prerequisites ap ON a.id = ap.atom_id
     WHERE ap.prerequisite_atom_id = ?`,
    [atomId]
  );
  return rows.map(parseAtomRow);
}

export function searchAtoms(searchTerm: string, sectionCode?: string): Atom[] {
  let sql = `
    SELECT a.* FROM atoms a
    INNER JOIN subtopics st ON a.subtopic_id = st.id
    INNER JOIN topics t ON st.topic_id = t.id
    INNER JOIN sections s ON t.section_id = s.id
    WHERE (a.name LIKE ? OR a.code LIKE ? OR a.description LIKE ?)
  `;
  const params: (string | number | null)[] = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];
  
  if (sectionCode) {
    sql += ' AND s.code = ?';
    params.push(sectionCode);
  }
  
  sql += ' ORDER BY s.sort_order, t.sort_order, st.sort_order, a.sort_order';
  
  const rows = query<AtomRow>(sql, params);
  return rows.map(parseAtomRow);
}

// ============================================
// Question Type Functions
// ============================================

export function getQuestionTypesBySection(sectionId: number): QuestionType[] {
  return query<QuestionType>(
    'SELECT * FROM question_types WHERE section_id = ?',
    [sectionId]
  );
}

export function getQuestionTypeByCode(code: string): QuestionType | null {
  const row = queryOne<QuestionType>('SELECT * FROM question_types WHERE code = ?', [code]);
  return row ?? null;
}

export function getAllQuestionTypes(): QuestionType[] {
  return query<QuestionType>('SELECT * FROM question_types ORDER BY section_id');
}

// ============================================
// Method Archetype Functions
// ============================================

export function getAllMethodArchetypes(): MethodArchetype[] {
  const rows = query<MethodArchetype & { applicable_sections: string }>(
    'SELECT * FROM method_archetypes'
  );
  return rows.map(row => ({
    ...row,
    applicable_sections: JSON.parse(row.applicable_sections) as string[],
  }));
}

export function getMethodArchetypeByCode(code: string): MethodArchetype | null {
  const row = queryOne<MethodArchetype & { applicable_sections: string }>(
    'SELECT * FROM method_archetypes WHERE code = ?',
    [code]
  );
  if (!row) return null;
  return {
    ...row,
    applicable_sections: JSON.parse(row.applicable_sections) as string[],
  };
}

export function getMethodArchetypesForSection(sectionCode: string): MethodArchetype[] {
  const all = getAllMethodArchetypes();
  return all.filter(m => m.applicable_sections.includes(sectionCode));
}

// ============================================
// Trap Archetype Functions
// ============================================

export function getAllTrapArchetypes(): TrapArchetype[] {
  const rows = query<TrapArchetype & { applicable_sections: string }>(
    'SELECT * FROM trap_archetypes'
  );
  return rows.map(row => ({
    ...row,
    applicable_sections: JSON.parse(row.applicable_sections) as string[],
  }));
}

export function getTrapArchetypeByCode(code: string): TrapArchetype | null {
  const row = queryOne<TrapArchetype & { applicable_sections: string }>(
    'SELECT * FROM trap_archetypes WHERE code = ?',
    [code]
  );
  if (!row) return null;
  return {
    ...row,
    applicable_sections: JSON.parse(row.applicable_sections) as string[],
  };
}

export function getTrapArchetypesForSection(sectionCode: string): TrapArchetype[] {
  const all = getAllTrapArchetypes();
  return all.filter(t => t.applicable_sections.includes(sectionCode));
}

// ============================================
// Taxonomy Tree Functions
// ============================================

export interface TaxonomyTree {
  sections: Array<Section & {
    topics: Array<Topic & {
      subtopics: Array<Subtopic & {
        atoms: Atom[];
      }>;
    }>;
  }>;
}

export function getFullTaxonomy(): TaxonomyTree {
  const sections = getAllSections();
  
  return {
    sections: sections.map(section => ({
      ...section,
      topics: getTopicsBySection(section.id).map(topic => ({
        ...topic,
        subtopics: getSubtopicsByTopic(topic.id).map(subtopic => ({
          ...subtopic,
          atoms: getAtomsBySubtopic(subtopic.id),
        })),
      })),
    })),
  };
}

export function getSectionTaxonomy(sectionCode: string): TaxonomyTree['sections'][0] | null {
  const section = getSectionByCode(sectionCode);
  if (!section) return null;
  
  return {
    ...section,
    topics: getTopicsBySection(section.id).map(topic => ({
      ...topic,
      subtopics: getSubtopicsByTopic(topic.id).map(subtopic => ({
        ...subtopic,
        atoms: getAtomsBySubtopic(subtopic.id),
      })),
    })),
  };
}
