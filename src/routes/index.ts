import { Router } from 'express';
import { healthRouter } from './health.js';

export function createRoutes(): Router {
  const router = Router();

  // Health check
  router.use('/health', healthRouter);

  // Future routes will be added here:
  // router.use('/user', userRouter);
  // router.use('/taxonomy', taxonomyRouter);
  // router.use('/questions', questionsRouter);
  // router.use('/errors', errorsRouter);
  // router.use('/scheduler', schedulerRouter);
  // router.use('/dashboard', dashboardRouter);
  // router.use('/generate', generateRouter);

  return router;
}
