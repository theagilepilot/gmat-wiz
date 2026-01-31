/**
 * Error Log API Routes
 * Error classification, reflection submission, and error analysis
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createErrorLog,
  getErrorLogById,
  getErrorLogByAttemptId,
  getRecentErrorLogs,
  getErrorLogsByType,
  updateErrorLog,
  resolveErrorLog,
  getAllErrorTypes,
  getErrorTypeByCode,
  getErrorTypesForSection,
  getAllErrorPatterns,
  type ErrorLogCreateInput,
} from '../models/ErrorLog.js';
import { getAttemptById } from '../models/Question.js';

export const errorsRouter = Router();

// ============================================
// GET /api/errors/types
// Get all error type definitions
// ============================================
errorsRouter.get('/types', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionCode = req.query.section as string | undefined;
    
    const errorTypes = sectionCode 
      ? getErrorTypesForSection(sectionCode)
      : getAllErrorTypes();

    res.json({
      success: true,
      data: errorTypes.map(et => ({
        code: et.code,
        name: et.name,
        category: et.category,
        description: et.description,
        remediationTips: et.remediation_tips,
        applicableSections: et.applicable_sections,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/errors/log
// Create a new error log entry
// ============================================
errorsRouter.post('/log', (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      attemptId,
      errorTypeCode,
      rootCause,
      userReasoning,
      correctReasoning,
      trapArchetypeCode,
      fellForTrap,
      methodUsedCode,
      optimalMethodCode,
      methodWasWrong,
      knowledgeGaps,
      actionItems,
      wasOverconfident,
      wasUnderconfident,
      severity,
    } = req.body;

    if (!attemptId || !errorTypeCode || !rootCause) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: attemptId, errorTypeCode, rootCause',
      });
      return;
    }

    // Verify attempt exists
    const attempt = getAttemptById(attemptId);
    if (!attempt) {
      res.status(404).json({ success: false, error: 'Attempt not found' });
      return;
    }

    const input: ErrorLogCreateInput = {
      attempt_id: attemptId,
      error_type_code: errorTypeCode,
      root_cause: rootCause,
      user_reasoning: userReasoning,
      correct_reasoning: correctReasoning,
      trap_archetype_code: trapArchetypeCode,
      fell_for_trap: fellForTrap,
      method_used_code: methodUsedCode,
      optimal_method_code: optimalMethodCode,
      method_was_wrong: methodWasWrong,
      knowledge_gaps: knowledgeGaps,
      action_items: actionItems,
      was_overconfident: wasOverconfident,
      was_underconfident: wasUnderconfident,
      severity,
    };

    const errorLog = createErrorLog(input);

    res.json({
      success: true,
      data: {
        id: errorLog.id,
        attemptId: errorLog.attempt_id,
        errorType: errorLog.error_type_code,
        rootCause: errorLog.root_cause,
        createdAt: errorLog.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/errors/attempt/:id
// Get error log for a specific attempt
// ============================================
errorsRouter.get('/attempt/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = parseInt(req.params.id as string, 10);
    const errorLog = getErrorLogByAttemptId(attemptId);

    if (!errorLog) {
      res.status(404).json({ success: false, error: 'No error log found for this attempt' });
      return;
    }

    const errorType = getErrorTypeByCode(errorLog.error_type_code);

    res.json({
      success: true,
      data: {
        id: errorLog.id,
        attemptId: errorLog.attempt_id,
        errorType: {
          code: errorLog.error_type_code,
          name: errorType?.name,
          category: errorType?.category,
        },
        rootCause: errorLog.root_cause,
        userReasoning: errorLog.user_reasoning,
        correctReasoning: errorLog.correct_reasoning,
        trapArchetype: errorLog.trap_archetype_code,
        fellForTrap: errorLog.fell_for_trap,
        methodUsed: errorLog.method_used_code,
        optimalMethod: errorLog.optimal_method_code,
        methodWasWrong: errorLog.method_was_wrong,
        knowledgeGaps: errorLog.knowledge_gaps,
        actionItems: errorLog.action_items,
        wasOverconfident: errorLog.was_overconfident,
        wasUnderconfident: errorLog.was_underconfident,
        severity: errorLog.severity,
        isResolved: errorLog.is_resolved,
        resolutionNotes: errorLog.resolution_notes,
        createdAt: errorLog.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/errors/history
// Get error log history with filters
// ============================================
errorsRouter.get('/history', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, limit = '50', unresolved } = req.query;
    const limitNum = parseInt(limit as string, 10);

    let errors;
    if (type) {
      errors = getErrorLogsByType(type as string);
    } else {
      errors = getRecentErrorLogs(limitNum);
    }

    if (unresolved === 'true') {
      errors = errors.filter(e => !e.is_resolved);
    }

    res.json({
      success: true,
      data: errors.map(e => ({
        id: e.id,
        attemptId: e.attempt_id,
        errorType: e.error_type_code,
        rootCause: e.root_cause,
        severity: e.severity,
        isResolved: e.is_resolved,
        createdAt: e.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /api/errors/:id
// Update an error log entry
// ============================================
errorsRouter.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const errorId = parseInt(req.params.id as string, 10);
    const updates = req.body;

    // Check if error exists first
    const existing = getErrorLogById(errorId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Error log not found' });
      return;
    }

    updateErrorLog(errorId, updates);

    res.json({
      success: true,
      data: {
        id: errorId,
        updated: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/errors/:id/resolve
// Mark an error as resolved
// ============================================
errorsRouter.post('/:id/resolve', (req: Request, res: Response, next: NextFunction) => {
  try {
    const errorId = parseInt(req.params.id as string, 10);
    const { notes } = req.body;

    resolveErrorLog(errorId, notes);

    res.json({
      success: true,
      data: {
        id: errorId,
        resolved: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/errors/patterns
// Get detected error patterns
// ============================================
errorsRouter.get('/patterns', (req: Request, res: Response, next: NextFunction) => {
  try {
    const patterns = getAllErrorPatterns();

    res.json({
      success: true,
      data: patterns.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        errorTypes: p.error_type_codes,
        atomCodes: p.atom_codes,
        occurrenceCount: p.occurrence_count,
        lastOccurrence: p.last_occurrence,
        isActive: p.is_active,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/errors/suggestions/:attemptId
// Get auto-suggested error types for an attempt
// ============================================
errorsRouter.get('/suggestions/:attemptId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = parseInt(req.params.attemptId as string, 10);
    const attempt = getAttemptById(attemptId);

    if (!attempt) {
      res.status(404).json({ success: false, error: 'Attempt not found' });
      return;
    }

    // Simple suggestion logic based on attempt characteristics
    const suggestions: { code: string; reason: string; confidence: number }[] = [];

    if (attempt.was_overtime) {
      suggestions.push({
        code: 'timing_slow',
        reason: 'You exceeded the time budget',
        confidence: 0.9,
      });
    }

    if (attempt.was_guessed) {
      suggestions.push({
        code: 'strategy_guessed',
        reason: 'You marked this as a guess',
        confidence: 0.95,
      });
    }

    if (!attempt.is_correct && attempt.confidence_before && attempt.confidence_before > 3) {
      suggestions.push({
        code: 'careless_overconfident',
        reason: 'High confidence but incorrect answer',
        confidence: 0.7,
      });
    }

    // Default suggestion if no specific signals
    if (suggestions.length === 0 && !attempt.is_correct) {
      suggestions.push({
        code: 'conceptual_gap',
        reason: 'Possible concept gap - please classify',
        confidence: 0.5,
      });
    }

    res.json({
      success: true,
      data: {
        attemptId,
        isCorrect: attempt.is_correct,
        suggestions: suggestions.sort((a, b) => b.confidence - a.confidence),
      },
    });
  } catch (error) {
    next(error);
  }
});
