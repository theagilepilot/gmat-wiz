import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  console.error('❌ Error:', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
    details: err.details,
  });

  // Determine status code
  const statusCode = err.statusCode ?? 500;

  // Build error response
  const errorResponse: {
    error: string;
    message: string;
    code?: string;
    details?: unknown;
  } = {
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message: statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  };

  // Add optional fields
  if (err.code) {
    errorResponse.code = err.code;
  }

  // Only include details in development
  if (process.env.NODE_ENV !== 'production' && err.details) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
}

// Helper to create typed errors
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: unknown
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

// Common error creators
export const errors = {
  badRequest: (message: string, details?: unknown) => 
    createError(message, 400, 'BAD_REQUEST', details),
  
  unauthorized: (message: string = 'Unauthorized') => 
    createError(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message: string = 'Forbidden') => 
    createError(message, 403, 'FORBIDDEN'),
  
  notFound: (resource: string = 'Resource') => 
    createError(`${resource} not found`, 404, 'NOT_FOUND'),
  
  conflict: (message: string, details?: unknown) => 
    createError(message, 409, 'CONFLICT', details),
  
  validation: (message: string, details?: unknown) => 
    createError(message, 422, 'VALIDATION_ERROR', details),
  
  internal: (message: string = 'Internal server error') => 
    createError(message, 500, 'INTERNAL_ERROR'),
  
  serviceUnavailable: (service: string) => 
    createError(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE'),
};
