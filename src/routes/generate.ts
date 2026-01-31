/**
 * Question Generation API Routes
 * Endpoints for generating and managing AI-generated questions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getQuestionGenerator } from '../services/ai/QuestionGenerator.js';
import { getQuestionValidator } from '../services/ai/QuestionValidator.js';
import { getOpenAIClient } from '../services/ai/OpenAIClient.js';
import { getAtomById } from '../models/SkillAtom.js';
import { createQuestion, linkQuestionToAtom } from '../models/Question.js';
import type { GenerationRequest, GMATSection, QuestionTypeCode } from '../services/ai/types.js';

export const generateRouter = Router();

// ============================================
// POST /api/generate/question
// Generate a single question
// ============================================
generateRouter.post('/question', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      section,
      questionType,
      targetDifficulty = 500,
      atomIds,
      trapArchetype,
      methodHint,
      timeBudgetSeconds,
      validate = true,
      publish = false,
    } = req.body;

    // Validate required fields
    if (!section || !questionType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: section, questionType',
      });
      return;
    }

    if (!atomIds || !Array.isArray(atomIds) || atomIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one atomId is required',
      });
      return;
    }

    // Check if OpenAI is configured
    const client = getOpenAIClient();
    if (!client.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI generation not available - OpenAI API key not configured',
      });
      return;
    }

    // Fetch atom details
    const atoms = atomIds.map((id: number) => getAtomById(id)).filter(Boolean);
    if (atoms.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No valid atoms found for the given IDs',
      });
      return;
    }

    // Build generation request
    const request: GenerationRequest = {
      section: section as GMATSection,
      questionType: questionType as QuestionTypeCode,
      targetDifficulty,
      targetAtomIds: atomIds,
      atomNames: atoms.map(a => a!.name),
      atomDescriptions: atoms.map(a => a!.description || ''),
      trapArchetype,
      methodHint,
      timeBudgetSeconds,
    };

    // Generate the question
    const generator = getQuestionGenerator();
    const result = await generator.generateWithRetry(request, 3);

    if (!result.success || !result.question) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate question',
        details: result.errors,
        attempts: result.attempts,
        tokensUsed: result.totalTokens,
      });
      return;
    }

    // Validate if requested
    let validationResult = null;
    if (validate) {
      const validator = getQuestionValidator();
      validationResult = validator.validate(result.question, {
        section: section as GMATSection,
        questionType: questionType as QuestionTypeCode,
        targetDifficulty,
      });
    }

    // Publish to database if requested and valid
    let publishedId = null;
    if (publish && (!validate || (validationResult && validationResult.isValid))) {
      const dbQuestion = createQuestion({
        section_code: section,
        question_type_code: questionType,
        difficulty_rating: result.question.estimatedDifficulty,
        stem: result.question.stem,
        answer_choices: result.question.choices.map(c => `${c.label}. ${c.text}`),
        correct_answer: result.question.correctAnswer,
        explanation: result.question.explanation,
        estimated_time_seconds: result.question.timeBudgetSeconds,
        source: 'ai_generated',
        ai_model: result.question.model,
        generation_params: {
          trapNotes: result.question.trapNotes,
          fastestMethod: result.question.fastestMethod,
          generationId: result.question.generationId,
        },
      });
      publishedId = dbQuestion.id;

      // Link atoms to the question
      atomIds.forEach((atomId: number, index: number) => {
        linkQuestionToAtom(publishedId!, atomId, index === 0);
      });
    }

    res.json({
      success: true,
      data: {
        question: {
          stem: result.question.stem,
          choices: result.question.choices,
          correctAnswer: result.question.correctAnswer,
          explanation: result.question.explanation,
          fastestMethod: result.question.fastestMethod,
          trapNotes: result.question.trapNotes,
          estimatedDifficulty: result.question.estimatedDifficulty,
          timeBudgetSeconds: result.question.timeBudgetSeconds,
        },
        generation: {
          id: result.question.generationId,
          model: result.question.model,
          attempts: result.attempts,
          tokensUsed: result.totalTokens,
        },
        validation: validationResult ? {
          isValid: validationResult.isValid,
          score: validationResult.score,
          issues: validationResult.issues,
          suggestions: validationResult.suggestions,
        } : null,
        publishedId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/generate/batch
// Generate multiple questions
// ============================================
generateRouter.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requests, maxConcurrent = 2 } = req.body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      res.status(400).json({
        success: false,
        error: 'requests array is required',
      });
      return;
    }

    if (requests.length > 10) {
      res.status(400).json({
        success: false,
        error: 'Maximum 10 questions per batch',
      });
      return;
    }

    const client = getOpenAIClient();
    if (!client.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI generation not available',
      });
      return;
    }

    const generator = getQuestionGenerator();
    const validator = getQuestionValidator();
    const results: Array<{
      success: boolean;
      question: unknown;
      validation: unknown;
      errors: string[];
    }> = [];

    let totalTokens = 0;
    let successCount = 0;

    // Process in batches to respect rate limits
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (reqData: {
        section: GMATSection;
        questionType: QuestionTypeCode;
        targetDifficulty?: number;
        atomIds: number[];
        trapArchetype?: string;
        methodHint?: string;
      }) => {
        const atoms = reqData.atomIds.map((id: number) => getAtomById(id)).filter(Boolean);
        
        if (atoms.length === 0) {
          return {
            success: false,
            question: null,
            validation: null,
            errors: ['No valid atoms found'],
          };
        }

        const genRequest: GenerationRequest = {
          section: reqData.section,
          questionType: reqData.questionType,
          targetDifficulty: reqData.targetDifficulty || 500,
          targetAtomIds: reqData.atomIds,
          atomNames: atoms.map(a => a!.name),
          atomDescriptions: atoms.map(a => a!.description || ''),
          trapArchetype: reqData.trapArchetype,
          methodHint: reqData.methodHint,
        };

        const result = await generator.generateWithRetry(genRequest, 2);
        totalTokens += result.totalTokens;

        if (result.success && result.question) {
          successCount++;
          const valResult = validator.validate(result.question, {
            section: reqData.section,
            questionType: reqData.questionType,
            targetDifficulty: reqData.targetDifficulty || 500,
          });

          return {
            success: true,
            question: result.question,
            validation: valResult,
            errors: [],
          };
        }

        return {
          success: false,
          question: null,
          validation: null,
          errors: result.errors,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    res.json({
      success: true,
      data: {
        total: requests.length,
        successful: successCount,
        failed: requests.length - successCount,
        totalTokensUsed: totalTokens,
        results: results.map((r, i) => ({
          index: i,
          success: r.success,
          question: r.question ? {
            stem: (r.question as { stem: string }).stem,
            estimatedDifficulty: (r.question as { estimatedDifficulty: number }).estimatedDifficulty,
          } : null,
          validationScore: r.validation ? (r.validation as { score: number }).score : null,
          errors: r.errors,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/generate/status
// Get AI generation status and stats
// ============================================
generateRouter.get('/status', (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = getOpenAIClient();
    const rateLimitState = client.getRateLimitState();

    res.json({
      success: true,
      data: {
        available: client.isConfigured(),
        model: client.isConfigured() ? client.getModel() : null,
        rateLimit: {
          requestsThisMinute: rateLimitState.requestsThisMinute,
          tokensThisMinute: rateLimitState.tokensThisMinute,
          isLimited: rateLimitState.isLimited,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/generate/validate
// Validate a question without generating
// ============================================
generateRouter.post('/validate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, section, questionType, targetDifficulty = 500 } = req.body;

    if (!question || !section || !questionType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: question, section, questionType',
      });
      return;
    }

    const validator = getQuestionValidator();
    const result = validator.validate(question, {
      section,
      questionType,
      targetDifficulty,
    });

    res.json({
      success: true,
      data: {
        isValid: result.isValid,
        score: result.score,
        isPublishable: validator.isPublishable(result),
        issues: result.issues,
        suggestions: result.suggestions,
      },
    });
  } catch (error) {
    next(error);
  }
});
