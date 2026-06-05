import { execSync } from 'child_process';
import { beforeAll, afterAll } from 'vitest';
import { prisma } from './src/config/database';

// Set up environment variables for all tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pricecompare:pricecompare123@localhost:5432/pricecompare_test';
process.env.JWT_SECRET = 'this-is-a-very-long-secret-key-for-testing-purposes-minimum-32-chars';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173';
process.env.NODE_ENV = 'test';

// Attempt to sync the schema; log a warning if unavailable so unit tests still run
beforeAll(async () => {
  try {
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env },
      stdio: 'pipe',
    });
  } catch {
    console.warn('[test setup] prisma db push failed — unit tests will still run; integration tests requiring a live DB may be skipped');
  }
}, 30000);

afterAll(async () => {
  await prisma.$disconnect().catch(() => {});
});
