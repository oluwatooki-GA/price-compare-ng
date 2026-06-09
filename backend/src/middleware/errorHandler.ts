import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../config/sentry';
import { logger } from '../config/logger';
import {
  PriceCompareError,
  AuthenticationError,
  ValidationError,
  ResourceNotFoundError,
  RateLimitError,
  ScrapingError,
} from '../shared/errors';

interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let errorType = 'internal_server_error';
  let message = 'An unexpected error occurred';

  if (err instanceof ValidationError) {
    statusCode = 400; errorType = 'validation_error'; message = err.message;
  } else if (err instanceof AuthenticationError) {
    statusCode = 401; errorType = 'authentication_error'; message = err.message;
  } else if (err instanceof ResourceNotFoundError) {
    statusCode = 404; errorType = 'resource_not_found'; message = err.message;
  } else if (err instanceof RateLimitError) {
    statusCode = 429; errorType = 'rate_limit_error'; message = err.message;
  } else if (err instanceof ScrapingError) {
    statusCode = 503; errorType = 'service_unavailable'; message = err.message;
  } else if (err instanceof PriceCompareError) {
    statusCode = 500; errorType = 'application_error'; message = err.message;
  } else {
    Sentry.captureException(err);
    logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  }

  const errorResponse: ErrorResponse = { error: errorType, message, timestamp: new Date() };
  res.status(statusCode).json(errorResponse);
}
