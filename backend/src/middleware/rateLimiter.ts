import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for unauthenticated requests
 * 
 * Limits requests by IP address to prevent abuse from anonymous users.
 * Configuration: 10 requests per minute per IP
 * Uses in-memory storage (for single-instance deployments)
 * 
 * Validates: Requirements 9.1, 9.3, 9.5
 */
export const unauthenticatedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: 'draft-7', // Return rate limit info in `RateLimit-*` headers (includes Retry-After)
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Log rate limit violations (Requirement 9.5)
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

/**
 * Rate limiter for authenticated requests
 * 
 * Limits requests by user ID to provide higher limits for authenticated users
 * while still preventing abuse.
 * Configuration: 60 requests per minute per user
 * Uses in-memory storage (for single-instance deployments)
 * 
 * Validates: Requirements 9.2, 9.3, 9.5
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  // Use user ID from authenticated request, fallback to IP
  keyGenerator: (req) => {
    // @ts-expect-error - user is added by auth middleware
    return req.user?.id?.toString() || req.ip || 'unknown';
  },
  message: 'Too many requests, please try again later.',
  standardHeaders: 'draft-7', // Return rate limit info in `RateLimit-*` headers (includes Retry-After)
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Log rate limit violations (Requirement 9.5)
  handler: (req, res) => {
    // @ts-expect-error - user is added by auth middleware
    const identifier = req.user?.id || req.ip;
    console.warn(`Rate limit exceeded for user/IP: ${identifier}`);
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Gracefully disconnect (no-op for in-memory store)
 */
export async function disconnectRedis(): Promise<void> {
  // No-op when using in-memory store
}

// Dummy export for compatibility with tests
export const redisClient = {
  connect: async () => {},
  quit: async () => {},
  on: () => {},
};
