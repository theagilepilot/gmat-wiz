/**
 * Skill Atom Service
 * Business logic for navigating and working with skill taxonomy
 */

import {
  getAllSections,
  getSectionByCode,
  getTopicsBySection,
  getSubtopicsByTopic,
  getAtomsBySubtopic,
  getAtomById,
  getAtomByCode,
  getAtomWithPath,
  getAtomPrerequisites,
  getAtomsDependingOn,
  getFoundationalAtoms,
  getAtomsByDifficultyTier,
  searchAtoms,
  getAllQuestionTypes,
  getQuestionTypeByCode,
  getAllMethodArchetypes,
  getAllTrapArchetypes,
  getFullTaxonomy,
  getSectionTaxonomy,
  type Section,
  type Topic,
  type Subtopic,
  type Atom,
  type AtomWithPath,
  type QuestionType,
  type MethodArchetype,
  type TrapArchetype,
  type TaxonomyTree,
} from '../models/SkillAtom.js';

// Re-export types
export type {
  Section,
  Topic,
  Subtopic,
  Atom,
  AtomWithPath,
  QuestionType,
  MethodArchetype,
  TrapArchetype,
  TaxonomyTree,
};

// ============================================
// Types
// ============================================

export interface AtomMasteryRequirement {
  atomId: number;
  atomCode: string;
  atomName: string;
  requiredAccuracy: number;
  requiredAttempts: number;
  currentAccuracy: number;
  currentAttempts: number;
  isMastered: boolean;
}

export interface AtomCluster {
  atoms: Atom[];
  commonTopic: Topic | null;
  commonSubtopic: Subtopic | null;
  description: string;
}

// ============================================
// Service Functions
// ============================================

// Taxonomy navigation
export { getAllSections, getSectionByCode, getFullTaxonomy, getSectionTaxonomy };

export function getTopicsForSection(sectionCode: string): Topic[] {
  const section = getSectionByCode(sectionCode);
  if (!section) return [];
  return getTopicsBySection(section.id);
}

export function getSubtopicsForTopic(topicId: number): Subtopic[] {
  return getSubtopicsByTopic(topicId);
}

export function getAtomsForSubtopic(subtopicId: number): Atom[] {
  return getAtomsBySubtopic(subtopicId);
}

// Atom retrieval
export { getAtomById, getAtomByCode, getAtomWithPath };

export function getAtomPath(atomId: number): string | null {
  const atomWithPath = getAtomWithPath(atomId);
  return atomWithPath?.path ?? null;
}

// Atom relationships
export function getPrerequisiteChain(atomId: number, visited: Set<number> = new Set()): Atom[] {
  if (visited.has(atomId)) return [];
  visited.add(atomId);
  
  const directPrereqs = getAtomPrerequisites(atomId);
  const allPrereqs: Atom[] = [...directPrereqs];
  
  for (const prereq of directPrereqs) {
    const transitivePrereqs = getPrerequisiteChain(prereq.id, visited);
    allPrereqs.push(...transitivePrereqs);
  }
  
  return allPrereqs;
}

export function getDependentChain(atomId: number, visited: Set<number> = new Set()): Atom[] {
  if (visited.has(atomId)) return [];
  visited.add(atomId);
  
  const directDependents = getAtomsDependingOn(atomId);
  const allDependents: Atom[] = [...directDependents];
  
  for (const dependent of directDependents) {
    const transitiveDependents = getDependentChain(dependent.id, visited);
    allDependents.push(...transitiveDependents);
  }
  
  return allDependents;
}

export function canStudyAtom(atomId: number, masteredAtomIds: Set<number>): boolean {
  const prereqs = getAtomPrerequisites(atomId);
  return prereqs.every(prereq => masteredAtomIds.has(prereq.id));
}

// Atom filtering
export function getFoundationAtoms(): Atom[] {
  return getFoundationalAtoms();
}

export function getAtomsByDifficulty(tier: 1 | 2 | 3 | 4 | 5): Atom[] {
  return getAtomsByDifficultyTier(tier);
}

export function findAtoms(searchTerm: string, sectionCode?: string): Atom[] {
  return searchAtoms(searchTerm, sectionCode);
}

// Question types
export function getQuestionTypes(): QuestionType[] {
  return getAllQuestionTypes();
}

export function getQuestionType(code: string): QuestionType | null {
  return getQuestionTypeByCode(code);
}

export function getTimeBudgetForQuestionType(code: string): number {
  const qt = getQuestionTypeByCode(code);
  return qt?.time_budget_seconds ?? 120; // Default 2 minutes
}

// Method and trap archetypes
export function getMethodArchetypes(): MethodArchetype[] {
  return getAllMethodArchetypes();
}

export function getTrapArchetypes(): TrapArchetype[] {
  return getAllTrapArchetypes();
}

// Atom clustering (for scheduling and analytics)
export function clusterAtomsByTopic(atomIds: number[]): Map<number, Atom[]> {
  const clusters = new Map<number, Atom[]>();
  
  for (const atomId of atomIds) {
    const atomWithPath = getAtomWithPath(atomId);
    if (!atomWithPath) continue;
    
    const topicId = atomWithPath.topic.id;
    const existing = clusters.get(topicId) ?? [];
    existing.push(atomWithPath.atom);
    clusters.set(topicId, existing);
  }
  
  return clusters;
}

export function clusterAtomsBySection(atomIds: number[]): Map<string, Atom[]> {
  const clusters = new Map<string, Atom[]>();
  
  for (const atomId of atomIds) {
    const atomWithPath = getAtomWithPath(atomId);
    if (!atomWithPath) continue;
    
    const sectionCode = atomWithPath.section.code;
    const existing = clusters.get(sectionCode) ?? [];
    existing.push(atomWithPath.atom);
    clusters.set(sectionCode, existing);
  }
  
  return clusters;
}

// Suggested atoms based on prerequisites
export function getSuggestedNextAtoms(
  masteredAtomIds: Set<number>,
  sectionCode?: string
): Atom[] {
  const taxonomy = sectionCode ? getSectionTaxonomy(sectionCode) : null;
  const sections = taxonomy ? [taxonomy] : getFullTaxonomy().sections;
  
  const suggestions: Atom[] = [];
  
  for (const section of sections) {
    for (const topic of section.topics) {
      for (const subtopic of topic.subtopics) {
        for (const atom of subtopic.atoms) {
          // Skip already mastered
          if (masteredAtomIds.has(atom.id)) continue;
          
          // Check if all prerequisites are mastered
          if (canStudyAtom(atom.id, masteredAtomIds)) {
            suggestions.push(atom);
          }
        }
      }
    }
  }
  
  // Sort by difficulty tier, then foundational status
  return suggestions.sort((a, b) => {
    if (a.is_foundational !== b.is_foundational) {
      return a.is_foundational ? -1 : 1;
    }
    return a.difficulty_tier - b.difficulty_tier;
  });
}

// Statistics
export function countAtoms(sectionCode?: string): number {
  if (sectionCode) {
    const taxonomy = getSectionTaxonomy(sectionCode);
    if (!taxonomy) return 0;
    return taxonomy.topics.reduce(
      (sum, topic) => sum + topic.subtopics.reduce(
        (subSum, subtopic) => subSum + subtopic.atoms.length,
        0
      ),
      0
    );
  }
  
  const taxonomy = getFullTaxonomy();
  return taxonomy.sections.reduce(
    (sum, section) => sum + section.topics.reduce(
      (topicSum, topic) => topicSum + topic.subtopics.reduce(
        (subSum, subtopic) => subSum + subtopic.atoms.length,
        0
      ),
      0
    ),
    0
  );
}

export function countAtomsByDifficulty(): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  for (let tier = 1; tier <= 5; tier++) {
    counts[tier] = getAtomsByDifficultyTier(tier).length;
  }
  
  return counts;
}
