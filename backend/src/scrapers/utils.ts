/**
 * Scraper utility functions
 * Requirements 4.3, 4.5: Retry logic with exponential backoff and rate limiting
 */

import axios, { AxiosError } from 'axios';
import { ScrapingError } from '../shared/errors';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Configuration for rate limiting per platform
 */
export interface RateLimitConfig {
  requestsPerSecond: number;
}

/**
 * Configuration for HTTP request timeouts
 */
export interface TimeoutConfig {
  requestTimeoutMs: number;
  connectionTimeoutMs: number;
}

/**
 * Default retry configuration
 * Requirement 4.3: Retry up to 3 times with exponential backoff
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Default rate limit configuration
 * Requirement 4.5: Respect rate limiting to avoid overwhelming platform servers
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerSecond: 2,
};

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  requestTimeoutMs: 10000,
  connectionTimeoutMs: 5000,
};

/**
 * Rate limiter class to control request frequency per platform
 */
export class RateLimiter {
  private lastRequestTime: number = 0;
  private minIntervalMs: number;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    this.minIntervalMs = 1000 / config.requestsPerSecond;
  }

  /**
   * Wait if necessary to respect rate limit
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // Network errors are retryable
    if (axiosError.code === 'ECONNABORTED' || 
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ECONNRESET' ||
        axiosError.code === 'ENOTFOUND') {
      return true;
    }
    
    // 5xx server errors are retryable
    if (axiosError.response && axiosError.response.status >= 500) {
      return true;
    }
    
    // 429 Too Many Requests is retryable
    if (axiosError.response && axiosError.response.status === 429) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Execute a function with retry logic and exponential backoff
 * Requirement 4.3: Retry up to 3 times with exponential backoff
 * 
 * @param fn - Async function to execute
 * @param retryConfig - Retry configuration
 * @returns Result of the function
 * @throws ScrapingError if all retry attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If error is not retryable or this was the last attempt, throw immediately
      if (!isRetryableError(error) || attempt === retryConfig.maxAttempts) {
        break;
      }
      
      // Calculate backoff delay and wait
      const delay = calculateBackoffDelay(attempt, retryConfig);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries failed
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  throw new ScrapingError(
    `Failed after ${retryConfig.maxAttempts} attempts: ${errorMessage}`
  );
}

/**
 * Create an axios instance with timeout configuration
 * 
 * @param timeoutConfig - Timeout configuration
 * @returns Configured axios instance
 */
export function createHttpClient(
  timeoutConfig: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG
) {
  return axios.create({
    timeout: timeoutConfig.requestTimeoutMs,
    headers: {
      'User-Agent': 'PriceCompare-NG/1.0 (Price Comparison Service)',
    },
  });
}

/**
 * Fetch HTML content from a URL with retry logic and rate limiting
 * 
 * @param url - URL to fetch
 * @param rateLimiter - Rate limiter instance
 * @param retryConfig - Retry configuration
 * @param timeoutConfig - Timeout configuration
 * @returns HTML content as string
 * @throws ScrapingError if request fails after retries
 */
export async function fetchWithRetry(
  url: string,
  rateLimiter: RateLimiter,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  timeoutConfig: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG
): Promise<string> {
  // Wait for rate limiter
  await rateLimiter.waitIfNeeded();
  
  // Create HTTP client with timeout
  const httpClient = createHttpClient(timeoutConfig);
  
  // Execute request with retry logic
  return withRetry(async () => {
    try {
      const response = await httpClient.get(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          throw new ScrapingError(
            `HTTP ${axiosError.response.status}: Failed to fetch ${url}`
          );
        } else if (axiosError.code) {
          throw new ScrapingError(
            `Network error (${axiosError.code}): Failed to fetch ${url}`
          );
        }
      }
      throw new ScrapingError(`Failed to fetch ${url}: ${error}`);
    }
  }, retryConfig);
}
