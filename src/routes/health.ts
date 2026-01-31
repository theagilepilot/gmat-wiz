import { Router, Request, Response } from 'express';
import { getConfig } from '../config/index.js';
import { getDatabase } from '../db/connection.js';

export const healthRouter = Router();

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: 'ok' | 'error';
    openai: 'ok' | 'not_configured' | 'error';
  };
}

healthRouter.get('/', (_req: Request, res: Response) => {
  const config = getConfig();
  
  // Check database
  let databaseStatus: 'ok' | 'error' = 'error';
  try {
    const db = getDatabase();
    db.exec('SELECT 1');
    databaseStatus = 'ok';
  } catch {
    databaseStatus = 'error';
  }

  // Check OpenAI configuration
  const openaiStatus: 'ok' | 'not_configured' | 'error' = 
    config.openaiApiKey ? 'ok' : 'not_configured';

  // Determine overall status
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
  if (databaseStatus === 'error') {
    overallStatus = 'error';
  } else if (openaiStatus === 'not_configured') {
    overallStatus = 'degraded';
  }

  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    checks: {
      database: databaseStatus,
      openai: openaiStatus,
    },
  };

  const statusCode = overallStatus === 'error' ? 503 : 200;
  res.status(statusCode).json(health);
});

// Detailed health check for debugging
healthRouter.get('/detailed', (_req: Request, res: Response) => {
  const config = getConfig();
  
  res.json({
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
    },
    config: {
      port: config.port,
      host: config.host,
      databasePath: config.databasePath,
      studyDocsPath: config.studyDocsPath,
      openaiConfigured: !!config.openaiApiKey,
      openaiModel: config.openaiModel,
    },
  });
});
