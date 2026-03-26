import { execSync } from 'child_process';
import { beforeAll, afterAll } from 'vitest';
import { prisma } from './src/config/database';

// Set up environment variables for all tests
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'this-is-a-very-long-secret-key-for-testing-purposes-minimum-32-chars';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173';
process.env.NODE_ENV = 'test';

// Run migrations before all tests
beforeAll(async () => {
  // Push the schema to the test database
  execSync('npx prisma db push --skip-generate', { 
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit'
  });
}, 30000); // 30 second timeout for migrations

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
