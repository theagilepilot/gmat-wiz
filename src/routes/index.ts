import { Router } from 'express';
import { healthRouter } from './health.js';
import { questionsRouter } from './questions.js';
import { userRouter } from './user.js';
import { taxonomyRouter } from './taxonomy.js';
import { errorsRouter } from './errors.js';
import { schedulerRouter } from './scheduler.js';
import { dashboardRouter } from './dashboard.js';
import { generateRouter } from './generate.js';

export function createRoutes(): Router {
  const router = Router();

  // Health check
  router.use('/health', healthRouter);

  // Core API routes
  router.use('/user', userRouter);
  router.use('/taxonomy', taxonomyRouter);
  router.use('/questions', questionsRouter);
  router.use('/errors', errorsRouter);
  router.use('/scheduler', schedulerRouter);
  router.use('/dashboard', dashboardRouter);

  // AI generation routes
  router.use('/generate', generateRouter);

  return router;
}
