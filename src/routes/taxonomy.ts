/**
 * Taxonomy API Routes
 * Browse and query skill atom taxonomy
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllSections,
  getSectionByCode,
  getTopicsForSection,
  getSubtopicsForTopic,
  getAtomsForSubtopic,
  getAtomById,
  getAtomByCode,
  getAtomWithPath,
  getPrerequisiteChain,
  getDependentChain,
  getFoundationAtoms,
  getAtomsByDifficulty,
  findAtoms,
  getFullTaxonomy,
  getSectionTaxonomy,
} from '../services/SkillAtomService.js';
import {
  getAllQuestionTypes,
  getQuestionTypeByCode,
  getAllMethodArchetypes,
  getAllTrapArchetypes,
} from '../models/SkillAtom.js';

export const taxonomyRouter = Router();

// ============================================
// GET /api/taxonomy/sections
// List all GMAT sections
// ============================================
taxonomyRouter.get('/sections', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = getAllSections();

    res.json({
      success: true,
      data: sections.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        sortOrder: s.sort_order,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/sections/:code
// Get section details with topics
// ============================================
taxonomyRouter.get('/sections/:code', (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = getSectionByCode(req.params.code as string);
    if (!section) {
      res.status(404).json({ success: false, error: 'Section not found' });
      return;
    }

    const topics = getTopicsForSection(section.code);

    res.json({
      success: true,
      data: {
        id: section.id,
        code: section.code,
        name: section.name,
        description: section.description,
        topics: topics.map(t => ({
          id: t.id,
          code: t.code,
          name: t.name,
          description: t.description,
          sortOrder: t.sort_order,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/topics/:id/subtopics
// Get subtopics for a topic
// ============================================
taxonomyRouter.get('/topics/:id/subtopics', (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = parseInt(req.params.id as string, 10);
    const subtopics = getSubtopicsForTopic(topicId);

    res.json({
      success: true,
      data: subtopics.map(st => ({
        id: st.id,
        code: st.code,
        name: st.name,
        description: st.description,
        sortOrder: st.sort_order,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/subtopics/:id/atoms
// Get atoms for a subtopic
// ============================================
taxonomyRouter.get('/subtopics/:id/atoms', (req: Request, res: Response, next: NextFunction) => {
  try {
    const subtopicId = parseInt(req.params.id as string, 10);
    const atoms = getAtomsForSubtopic(subtopicId);

    res.json({
      success: true,
      data: atoms.map(a => ({
        id: a.id,
        code: a.code,
        name: a.name,
        description: a.description,
        difficultyTier: a.difficulty_tier,
        isFoundational: a.is_foundational,
        sortOrder: a.sort_order,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/atoms
// Query atoms with filters
// ============================================
taxonomyRouter.get('/atoms', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, section, difficulty, foundational } = req.query;

    let atoms;
    if (search) {
      atoms = findAtoms(search as string, section as string | undefined);
    } else if (foundational === 'true') {
      atoms = getFoundationAtoms();
    } else if (difficulty) {
      const tier = parseInt(difficulty as string, 10) as 1 | 2 | 3 | 4 | 5;
      atoms = getAtomsByDifficulty(tier);
    } else {
      // Return foundational atoms by default to avoid huge response
      atoms = getFoundationAtoms();
    }

    res.json({
      success: true,
      data: atoms.map(a => ({
        id: a.id,
        code: a.code,
        name: a.name,
        description: a.description,
        difficultyTier: a.difficulty_tier,
        isFoundational: a.is_foundational,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/atoms/:id
// Get atom details with prerequisites
// ============================================
taxonomyRouter.get('/atoms/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const atomId = parseInt(req.params.id as string, 10);
    const atomWithPath = getAtomWithPath(atomId);

    if (!atomWithPath) {
      res.status(404).json({ success: false, error: 'Atom not found' });
      return;
    }

    const prerequisites = getPrerequisiteChain(atomId);
    const dependents = getDependentChain(atomId);

    res.json({
      success: true,
      data: {
        id: atomWithPath.atom.id,
        code: atomWithPath.atom.code,
        name: atomWithPath.atom.name,
        description: atomWithPath.atom.description,
        difficultyTier: atomWithPath.atom.difficulty_tier,
        isFoundational: atomWithPath.atom.is_foundational,
        path: atomWithPath.path,
        section: atomWithPath.section.name,
        topic: atomWithPath.topic.name,
        subtopic: atomWithPath.subtopic.name,
        prerequisites: prerequisites.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
        })),
        dependents: dependents.slice(0, 10).map(d => ({
          id: d.id,
          code: d.code,
          name: d.name,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/full
// Get complete taxonomy tree
// ============================================
taxonomyRouter.get('/full', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionCode = req.query.section as string | undefined;
    
    const taxonomy = sectionCode 
      ? getSectionTaxonomy(sectionCode)
      : getFullTaxonomy();

    res.json({
      success: true,
      data: taxonomy,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/question-types
// Get all question types
// ============================================
taxonomyRouter.get('/question-types', (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionTypes = getAllQuestionTypes();

    res.json({
      success: true,
      data: questionTypes.map(qt => ({
        id: qt.id,
        code: qt.code,
        name: qt.name,
        sectionId: qt.section_id,
        description: qt.description,
        timeBudgetSeconds: qt.time_budget_seconds,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/methods
// Get all method archetypes
// ============================================
taxonomyRouter.get('/methods', (req: Request, res: Response, next: NextFunction) => {
  try {
    const methods = getAllMethodArchetypes();

    res.json({
      success: true,
      data: methods.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name,
        description: m.description,
        applicableSections: m.applicable_sections,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/taxonomy/traps
// Get all trap archetypes
// ============================================
taxonomyRouter.get('/traps', (req: Request, res: Response, next: NextFunction) => {
  try {
    const traps = getAllTrapArchetypes();

    res.json({
      success: true,
      data: traps.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        applicableSections: t.applicable_sections,
      })),
    });
  } catch (error) {
    next(error);
  }
});
