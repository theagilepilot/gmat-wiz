/**
 * Questions API Routes
 * Handles question fetching, submission, and feedback
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  selectQuestions,
  getNextQuestion,
  isQuestionAppropriate,
  getUserEloForContext,
  type SelectionMode,
} from '../services/QuestionSelectionService.js';
import {
  getQuestionById,
  createAttempt,
  updateQuestionStats,
  getAttemptById,
  getAttemptsByQuestion,
  linkQuestionToAtom,
  type AttemptCreateInput,
} from '../models/Question.js';
import {
  updateRating,
  getOrCreateRating,
  calculateExpectedScore,
} from '../models/EloRating.js';
import { addToReviewQueue } from '../models/Scheduling.js';

export const questionsRouter = Router();

// ============================================
// GET /api/questions/next
// Get the next question based on adaptive selection
// ============================================
questionsRouter.get('/next', (req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = (req.query.mode as SelectionMode) || 'build';
    const sectionCode = req.query.section as string | undefined;
    const excludeIds = req.query.exclude 
      ? (req.query.exclude as string).split(',').map(Number)
      : [];

    const selected = getNextQuestion(mode, sectionCode, excludeIds);

    if (!selected) {
      res.status(404).json({
        success: false,
        error: 'No questions available matching criteria',
        suggestion: 'Try a different section or add more questions to the database',
      });
      return;
    }

    // Return question without the correct answer
    const { question, reason, expectedScore, difficultyMatch } = selected;
    
    res.json({
      success: true,
      data: {
        id: question.id,
        section: question.section_code,
        questionType: question.question_type_code,
        stem: question.stem,
        answerChoices: question.answer_choices,
        statement1: question.statement_1,
        statement2: question.statement_2,
        estimatedTimeSeconds: question.estimated_time_seconds,
        difficulty: difficultyMatch,
        selectionReason: reason,
        expectedWinRate: Math.round(expectedScore * 100),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/questions/:id
// Get a specific question (without answer until attempted)
// ============================================
questionsRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionId = parseInt(req.params.id as string, 10);
    const includeAnswer = req.query.includeAnswer === 'true';

    const question = getQuestionById(questionId);
    if (!question) {
      res.status(404).json({
        success: false,
        error: 'Question not found',
      });
      return;
    }

    // Check if user has attempted this question
    const attempts = getAttemptsByQuestion(questionId);
    const hasAttempted = attempts.length > 0;

    const userElo = getUserEloForContext(question.section_code);
    const expectedScore = calculateExpectedScore(userElo, question.difficulty_rating);

    const response: Record<string, unknown> = {
      success: true,
      data: {
        id: question.id,
        section: question.section_code,
        questionType: question.question_type_code,
        stem: question.stem,
        answerChoices: question.answer_choices,
        statement1: question.statement_1,
        statement2: question.statement_2,
        estimatedTimeSeconds: question.estimated_time_seconds,
        difficultyRating: question.difficulty_rating,
        expectedWinRate: Math.round(expectedScore * 100),
        hasAttempted,
        attemptCount: attempts.length,
      },
    };

    // Only include answer/explanation if requested AND user has attempted
    if (includeAnswer && hasAttempted) {
      response.data = {
        ...response.data as object,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        tags: question.tags,
      };
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/questions/:id/attempt
// Submit an answer for a question
// ============================================
questionsRouter.post('/:id/attempt', (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionId = parseInt(req.params.id as string, 10);
    const {
      userAnswer,
      timeStarted,
      timeSubmitted,
      timeTakenSeconds,
      confidenceBefore,
      methodCode,
      wasGuessed,
      sessionId,
      trainingBlockId,
    } = req.body;

    // Validate required fields
    if (!userAnswer || !timeStarted || !timeSubmitted || timeTakenSeconds === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userAnswer, timeStarted, timeSubmitted, timeTakenSeconds',
      });
      return;
    }

    // Get the question
    const question = getQuestionById(questionId);
    if (!question) {
      res.status(404).json({
        success: false,
        error: 'Question not found',
      });
      return;
    }

    // Check if answer is correct
    const isCorrect = userAnswer.toUpperCase() === question.correct_answer.toUpperCase();
    const wasOvertime = timeTakenSeconds > question.estimated_time_seconds;

    // Get user's current ELO
    const userElo = getUserEloForContext(question.section_code);

    // Create the attempt record
    const attemptInput: AttemptCreateInput = {
      question_id: questionId,
      session_id: sessionId,
      training_block_id: trainingBlockId,
      user_answer: userAnswer,
      is_correct: isCorrect,
      time_started: timeStarted,
      time_submitted: timeSubmitted,
      time_taken_seconds: timeTakenSeconds,
      was_overtime: wasOvertime,
      user_elo_at_attempt: userElo,
      question_difficulty_at_attempt: question.difficulty_rating,
      confidence_before: confidenceBefore,
      method_code: methodCode,
      was_guessed: wasGuessed ?? false,
    };

    const attempt = createAttempt(attemptInput);

    // Update question statistics
    updateQuestionStats(questionId, isCorrect, timeTakenSeconds);

    // Update ELO ratings
    const globalRating = getOrCreateRating('global', null);
    updateRating(globalRating.id, question.difficulty_rating, isCorrect, attempt.id);

    const sectionRating = getOrCreateRating('section', question.section_code);
    updateRating(sectionRating.id, question.difficulty_rating, isCorrect, attempt.id);

    // Add to review queue if incorrect
    if (!isCorrect) {
      addToReviewQueue('question', questionId);
    }

    // Calculate performance metrics
    const expectedScore = calculateExpectedScore(userElo, question.difficulty_rating);
    const performance = isCorrect 
      ? (expectedScore < 0.5 ? 'upset_win' : 'expected_win')
      : (expectedScore > 0.5 ? 'upset_loss' : 'expected_loss');

    res.json({
      success: true,
      data: {
        attemptId: attempt.id,
        isCorrect,
        wasOvertime,
        performance,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        timeTakenSeconds,
        timeAllowed: question.estimated_time_seconds,
        userElo,
        questionDifficulty: question.difficulty_rating,
        expectedWinRate: Math.round(expectedScore * 100),
        // Prompt for reflection if incorrect
        requiresReflection: !isCorrect,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/questions/:id/explanation
// Get explanation (only after attempt)
// ============================================
questionsRouter.get('/:id/explanation', (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionId = parseInt(req.params.id as string, 10);

    const question = getQuestionById(questionId);
    if (!question) {
      res.status(404).json({
        success: false,
        error: 'Question not found',
      });
      return;
    }

    // Check if user has attempted this question
    const attempts = getAttemptsByQuestion(questionId);
    if (attempts.length === 0) {
      res.status(403).json({
        success: false,
        error: 'You must attempt the question before viewing the explanation',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        tags: question.tags,
        attemptHistory: attempts.map(a => ({
          id: a.id,
          userAnswer: a.user_answer,
          isCorrect: a.is_correct,
          timeTaken: a.time_taken_seconds,
          wasOvertime: a.was_overtime,
          date: a.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/questions/batch
// Get multiple questions for a training block
// ============================================
questionsRouter.post('/batch', (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      mode = 'build',
      sectionCode,
      targetAtomIds,
      excludeQuestionIds,
      count = 10,
    } = req.body;

    const selected = selectQuestions({
      mode: mode as SelectionMode,
      sectionCode,
      targetAtomIds,
      excludeQuestionIds,
      count,
    });

    res.json({
      success: true,
      data: {
        count: selected.length,
        questions: selected.map(({ question, reason, expectedScore, difficultyMatch }) => ({
          id: question.id,
          section: question.section_code,
          questionType: question.question_type_code,
          stem: question.stem,
          answerChoices: question.answer_choices,
          statement1: question.statement_1,
          statement2: question.statement_2,
          estimatedTimeSeconds: question.estimated_time_seconds,
          difficulty: difficultyMatch,
          selectionReason: reason,
          expectedWinRate: Math.round(expectedScore * 100),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
