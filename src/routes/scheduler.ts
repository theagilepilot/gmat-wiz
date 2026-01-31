/**
 * Scheduler API Routes
 * Daily guidance, training blocks, and review queue management
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createTrainingBlock,
  getTrainingBlockById,
  getPendingBlocks,
  getActiveBlock,
  startBlock,
  completeBlock,
  recordBlockProgress,
  getDueReviews,
  processReview,
  getReviewQueueItemById,
  getMasteryGate,
  getUnlockedGates,
  getLockedGates,
  getOrCreateDailyGoal,
  updateDailyProgress,
  getActiveStudyPlan,
  type TrainingBlockCreateInput,
} from '../models/Scheduling.js';
import { getProfile, getSettings } from '../services/UserProgressService.js';
import { selectQuestions, type SelectionMode } from '../services/QuestionSelectionService.js';

export const schedulerRouter = Router();

// ============================================
// GET /api/scheduler/today
// Get today's recommended training plan
// ============================================
schedulerRouter.get('/today', (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = getProfile();
    const settings = getSettings();
    const today = new Date().toISOString().split('T')[0];
    const dailyGoal = getOrCreateDailyGoal(today);
    const pendingBlocks = getPendingBlocks();
    const activeBlock = getActiveBlock();
    const dueReviews = getDueReviews(10);
    const activePlan = getActiveStudyPlan();

    // Calculate suggested activities
    const suggestions: { type: string; priority: number; reason: string }[] = [];

    // Check for overdue reviews
    if (dueReviews.length > 0) {
      suggestions.push({
        type: 'review',
        priority: 1,
        reason: `${dueReviews.length} items due for review`,
      });
    }

    // Check daily goal progress
    const goalProgress = dailyGoal.questions_done / dailyGoal.target_questions;
    if (goalProgress < 0.5) {
      suggestions.push({
        type: 'practice',
        priority: 2,
        reason: 'Work toward your daily goal',
      });
    }

    // If no pending blocks, suggest creating one
    if (pendingBlocks.length === 0 && !activeBlock) {
      suggestions.push({
        type: 'create_block',
        priority: 3,
        reason: 'No training blocks scheduled',
      });
    }

    res.json({
      success: true,
      data: {
        date: new Date().toISOString().split('T')[0],
        dailyGoal: {
          targetQuestions: dailyGoal.target_questions,
          targetMinutes: dailyGoal.target_minutes,
          questionsCompleted: dailyGoal.questions_done,
          minutesStudied: dailyGoal.minutes_studied,
          accuracy: dailyGoal.accuracy_achieved,
          xpEarned: dailyGoal.xp_earned,
          goalsMet: dailyGoal.goals_met,
        },
        activeBlock: activeBlock ? {
          id: activeBlock.id,
          name: activeBlock.name,
          type: activeBlock.block_type,
          progress: activeBlock.questions_answered,
          total: activeBlock.question_count,
          startedAt: activeBlock.started_at,
        } : null,
        pendingBlocks: pendingBlocks.slice(0, 5).map(b => ({
          id: b.id,
          name: b.name,
          type: b.block_type,
          questionCount: b.question_count,
          priority: b.priority,
        })),
        reviewsDue: dueReviews.length,
        suggestions: suggestions.sort((a, b) => a.priority - b.priority),
        studyPlan: activePlan ? {
          currentWeek: activePlan.current_week,
          currentDay: activePlan.current_day,
          startDate: activePlan.start_date,
          endDate: activePlan.end_date,
        } : null,
        streakDays: profile.study_streak_days,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/scheduler/blocks
// Create a new training block
// ============================================
schedulerRouter.post('/blocks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      blockType = 'skill_build',
      sectionCode,
      questionCount = 10,
      timeLimitSeconds,
      difficultyTarget,
      targetAtoms,
      scheduledFor,
      priority = 0,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Block name is required' });
      return;
    }

    const input: TrainingBlockCreateInput = {
      name,
      block_type: blockType,
      section_code: sectionCode,
      question_count: questionCount,
      time_limit_seconds: timeLimitSeconds,
      difficulty_target: difficultyTarget,
      target_atoms: targetAtoms,
      scheduled_for: scheduledFor,
      priority,
    };

    const block = createTrainingBlock(input);

    res.json({
      success: true,
      data: {
        id: block.id,
        name: block.name,
        type: block.block_type,
        questionCount: block.question_count,
        status: block.status,
        createdAt: block.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/scheduler/blocks/:id/start
// Start a training block
// ============================================
schedulerRouter.post('/blocks/:id/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockId = parseInt(req.params.id as string, 10);

    const block = startBlock(blockId);

    // Pre-select questions for the block
    const mode: SelectionMode = block.block_type === 'timed_drill' ? 'prove' : 'build';
    const questions = selectQuestions({
      mode,
      sectionCode: block.section_code ?? undefined,
      targetAtomIds: block.target_atoms.length > 0 ? block.target_atoms : undefined,
      count: block.question_count,
    });

    res.json({
      success: true,
      data: {
        id: block.id,
        name: block.name,
        type: block.block_type,
        status: block.status,
        startedAt: block.started_at,
        questionCount: block.question_count,
        timeLimit: block.time_limit_seconds,
        questions: questions.map(q => ({
          id: q.question.id,
          difficulty: q.difficultyMatch,
          expectedWinRate: Math.round(q.expectedScore * 100),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/scheduler/blocks/:id/progress
// Update training block progress (record one answer)
// ============================================
schedulerRouter.post('/blocks/:id/progress', (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockId = parseInt(req.params.id as string, 10);
    const { wasCorrect, timeSeconds } = req.body;

    if (wasCorrect === undefined || timeSeconds === undefined) {
      res.status(400).json({ success: false, error: 'Missing required fields: wasCorrect, timeSeconds' });
      return;
    }

    recordBlockProgress(blockId, wasCorrect, timeSeconds);

    const block = getTrainingBlockById(blockId);

    res.json({
      success: true,
      data: {
        id: blockId,
        progress: block?.questions_answered,
        correct: block?.questions_correct,
        timeSpent: block?.time_spent_seconds,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/scheduler/blocks/:id/complete
// Complete a training block
// ============================================
schedulerRouter.post('/blocks/:id/complete', (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockId = parseInt(req.params.id as string, 10);

    const block = completeBlock(blockId);

    // Update daily goal
    updateDailyProgress(
      block.questions_answered,
      Math.floor(block.time_spent_seconds / 60),
      block.questions_correct,
      block.questions_answered
    );

    const accuracy = block.questions_answered > 0
      ? Math.round((block.questions_correct / block.questions_answered) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        id: block.id,
        name: block.name,
        status: block.status,
        completedAt: block.completed_at,
        summary: {
          questionsAnswered: block.questions_answered,
          questionsCorrect: block.questions_correct,
          accuracy,
          timeSpentMinutes: Math.floor(block.time_spent_seconds / 60),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/scheduler/reviews
// Get items due for review
// ============================================
schedulerRouter.get('/reviews', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const dueItems = getDueReviews(limit);

    res.json({
      success: true,
      data: dueItems.map(item => ({
        id: item.id,
        type: item.item_type,
        itemId: item.item_id,
        nextReviewDate: item.next_review_date,
        isOverdue: item.is_overdue,
        repetitions: item.repetitions,
        intervalDays: item.interval_days,
        priority: item.priority,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/scheduler/reviews/:id/complete
// Process a review item (SM-2 algorithm)
// ============================================
schedulerRouter.post('/reviews/:id/complete', (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewId = parseInt(req.params.id as string, 10);
    const { quality } = req.body; // 0-5 scale

    if (quality === undefined || quality < 0 || quality > 5) {
      res.status(400).json({
        success: false,
        error: 'Quality rating (0-5) is required',
      });
      return;
    }

    const item = processReview(reviewId, quality);

    res.json({
      success: true,
      data: {
        id: item.id,
        newInterval: item.interval_days,
        nextReviewDate: item.next_review_date,
        easeFactor: Math.round(item.ease_factor * 100) / 100,
        repetitions: item.repetitions,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/scheduler/gates
// Get mastery gates status
// ============================================
schedulerRouter.get('/gates', (req: Request, res: Response, next: NextFunction) => {
  try {
    const unlockedGates = getUnlockedGates();
    const lockedGates = getLockedGates();

    res.json({
      success: true,
      data: {
        total: unlockedGates.length + lockedGates.length,
        unlocked: unlockedGates.length,
        blocking: lockedGates.map(g => ({
          id: g.id,
          type: g.gate_type,
          unlocksCode: g.unlocks_code,
          requirements: g.requirements,
          progress: g.progress_json,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/scheduler/blocking-gates
// Get gates currently blocking progress
// ============================================
schedulerRouter.get('/blocking-gates', (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockingGates = getLockedGates();

    res.json({
      success: true,
      data: blockingGates.map(g => ({
        id: g.id,
        type: g.gate_type,
        unlocksCode: g.unlocks_code,
        requirements: g.requirements,
        progress: g.progress_json,
        description: `Complete requirements to unlock ${g.unlocks_code}`,
      })),
    });
  } catch (error) {
    next(error);
  }
});
