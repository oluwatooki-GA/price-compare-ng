import { Request, Response, NextFunction } from 'express';
import {
  PriceCompareError,
  AuthenticationError,
  ValidationError,
  ResourceNotFoundError,
  RateLimitError,
  ScrapingError,
} from '../shared/errors';

/**
 * Error response format sent to clients
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Global error handling middleware for Express
 * Maps custom error classes to appropriate HTTP status codes
 * Formats error responses consistently
 * 
 * @param err - The error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (required by Express but unused)
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  // Default error response
  let statusCode = 500;
  let errorType = 'internal_server_error';
  let message = 'An unexpected error occurred';
  let details: Record<string, any> | undefined;

  // Map custom error classes to HTTP status codes
  if (err instanceof ValidationError) {
    statusCode = 400;
    errorType = 'validation_error';
    message = err.message;
  } else if (err instanceof AuthenticationError) {
    statusCode = 401;
    errorType = 'authentication_error';
    message = err.message;
  } else if (err instanceof ResourceNotFoundError) {
    statusCode = 404;
    errorType = 'resource_not_found';
    message = err.message;
  } else if (err instanceof RateLimitError) {
    statusCode = 429;
    errorType = 'rate_limit_error';
    message = err.message;
  } else if (err instanceof ScrapingError) {
    statusCode = 503;
    errorType = 'service_unavailable';
    message = err.message;
  } else if (err instanceof PriceCompareError) {
    // Generic PriceCompareError (not a specific subclass)
    statusCode = 500;
    errorType = 'application_error';
    message = err.message;
  } else {
    // Unexpected error - log full stack trace
    console.error('Unexpected error:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: errorType,
    message,
    timestamp: new Date(),
  };

  // Add details if available (for validation errors, etc.)
  if (details) {
    errorResponse.details = details;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}
