/**
 * Custom error classes for PriceCompare NG
 * Provides a hierarchy of errors for different failure scenarios
 */

/**
 * Base error class for all PriceCompare application errors
 */
export class PriceCompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceCompareError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when authentication fails
 * Used for invalid credentials, expired tokens, etc.
 */
export class AuthenticationError extends PriceCompareError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when input validation fails
 * Used for invalid request data, malformed inputs, etc.
 */
export class ValidationError extends PriceCompareError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when web scraping operations fail
 * Used for network errors, parsing failures, platform changes, etc.
 */
export class ScrapingError extends PriceCompareError {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapingError';
  }
}

/**
 * Error thrown when rate limits are exceeded
 * Used when users or IPs exceed allowed request rates
 */
export class RateLimitError extends PriceCompareError {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown when a requested resource is not found
 * Used for missing users, comparisons, or other resources
 */
export class ResourceNotFoundError extends PriceCompareError {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}
