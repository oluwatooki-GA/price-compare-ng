# Middleware

This directory contains Express middleware for the PriceCompare NG backend.

## Rate Limiter

The `rateLimiter.ts` module provides rate limiting middleware using Redis for distributed rate limiting.

### Configuration

Two rate limiters are provided:

1. **Unauthenticated Limiter** (`unauthenticatedLimiter`)
   - Limits: 10 requests per minute per IP address
   - Use for: Public endpoints that don't require authentication
   - Validates: Requirement 9.1

2. **Authenticated Limiter** (`authenticatedLimiter`)
   - Limits: 60 requests per minute per user
   - Use for: Protected endpoints that require authentication
   - Validates: Requirement 9.2

### Usage

```typescript
import { unauthenticatedLimiter, authenticatedLimiter } from './middleware/rateLimiter.js';
import { authMiddleware } from './middleware/auth.js';

// Apply to unauthenticated routes
router.get('/search', unauthenticatedLimiter, searchController.search);

// Apply to authenticated routes (after auth middleware)
router.get('/comparisons', authMiddleware, authenticatedLimiter, comparisonController.list);
```

### Redis Connection

The rate limiter requires a Redis instance to be running. Configure the Redis URL in your `.env` file:

```
REDIS_URL=redis://localhost:6379
```

### Error Handling

- Rate limit violations return a 429 status code with a JSON error response
- All violations are logged to the console for monitoring
- Redis connection errors are logged but don't crash the application

### Testing

To test the rate limiter:

1. Ensure Redis is running: `redis-server`
2. Run the tests: `npm test rateLimiter.test.ts`

### Cleanup

When shutting down the application, call `disconnectRedis()` to gracefully close the Redis connection:

```typescript
import { disconnectRedis } from './middleware/rateLimiter.js';

process.on('SIGTERM', async () => {
  await disconnectRedis();
  process.exit(0);
});
```
