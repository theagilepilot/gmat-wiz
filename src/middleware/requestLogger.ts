import { Request, Response, NextFunction } from 'express';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log request
  console.log(`→ ${timestamp} ${req.method} ${req.path}`);

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusEmoji = res.statusCode >= 400 ? '✗' : '✓';
    
    console.log(
      `← ${statusEmoji} ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}
