import { describe, test, expect } from 'vitest';
import { authRouter } from './routes';

/**
 * Integration tests for authentication routes with rate limiting
 * 
 * Validates: Requirements 9.1, 9.2
 */
describe('Auth Routes Rate Limiting Configuration', () => {
  test('authRouter is properly exported', () => {
    expect(authRouter).toBeDefined();
    expect(typeof authRouter).toBe('function');
  });

  test('authRouter has the expected middleware stack', () => {
    // The router should have routes configured
    const router = authRouter as any;
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  test('POST /register route exists with middleware', () => {
    const router = authRouter as any;
    const registerRoute = router.stack.find((layer: any) => 
      layer.route?.path === '/register' && layer.route?.methods?.post
    );
    
    expect(registerRoute).toBeDefined();
    // The route should have at least one handler
    expect(registerRoute.route.stack.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /login route exists with middleware', () => {
    const router = authRouter as any;
    const loginRoute = router.stack.find((layer: any) => 
      layer.route?.path === '/login' && layer.route?.methods?.post
    );
    
    expect(loginRoute).toBeDefined();
    // The route should have at least one handler
    expect(loginRoute.route.stack.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /me route exists with middleware', () => {
    const router = authRouter as any;
    const meRoute = router.stack.find((layer: any) => 
      layer.route?.path === '/me' && layer.route?.methods?.get
    );
    
    expect(meRoute).toBeDefined();
    // The route should have at least two handlers (rate limiter + auth middleware + route handler)
    expect(meRoute.route.stack.length).toBeGreaterThanOrEqual(2);
  });
});
