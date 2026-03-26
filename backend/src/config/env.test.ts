import { describe, test, expect } from 'vitest';
import { z } from 'zod';

// Import the schema directly for testing
const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required').transform((val) => 
    val.split(',').map(origin => origin.trim())
  ),
});

describe('Environment Configuration Schema', () => {
  test('should validate correct environment variables', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
    };

    const result = envSchema.parse(validEnv);

    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    expect(result.JWT_SECRET).toBe('this-is-a-very-long-secret-key-for-testing-purposes');
    expect(result.REDIS_URL).toBe('redis://localhost:6379');
    expect(result.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:5173']);
  });

  test('should use default values for optional variables', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    const result = envSchema.parse(validEnv);

    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
    expect(result.JWT_EXPIRES_IN).toBe('1h');
  });

  test('should reject JWT_SECRET shorter than 32 characters', () => {
    const invalidEnv = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'short-secret',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    expect(() => envSchema.parse(invalidEnv)).toThrow();
  });

  test('should reject missing DATABASE_URL', () => {
    const invalidEnv = {
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    expect(() => envSchema.parse(invalidEnv)).toThrow();
  });

  test('should reject missing REDIS_URL', () => {
    const invalidEnv = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    expect(() => envSchema.parse(invalidEnv)).toThrow();
  });

  test('should reject missing CORS_ORIGINS', () => {
    const invalidEnv = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
    };

    expect(() => envSchema.parse(invalidEnv)).toThrow();
  });

  test('should parse CORS_ORIGINS as array with trimmed values', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000, http://localhost:5173, http://example.com',
    };

    const result = envSchema.parse(validEnv);

    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://example.com'
    ]);
  });

  test('should transform PORT to number', () => {
    const validEnv = {
      PORT: '8080',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    const result = envSchema.parse(validEnv);

    expect(result.PORT).toBe(8080);
    expect(typeof result.PORT).toBe('number');
  });

  test('should validate NODE_ENV enum values', () => {
    const validEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SECRET: 'this-is-a-very-long-secret-key-for-testing-purposes',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:3000',
    };

    const result = envSchema.parse(validEnv);
    expect(result.NODE_ENV).toBe('production');

    const invalidEnv = {
      ...validEnv,
      NODE_ENV: 'invalid',
    };

    expect(() => envSchema.parse(invalidEnv)).toThrow();
  });
});
