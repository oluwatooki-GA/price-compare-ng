import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton instance
 * 
 * This ensures we only create one instance of PrismaClient throughout the application lifecycle.
 * In development, we store the instance on the global object to prevent hot-reloading from
 * creating multiple instances.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Connect to the database and verify the connection
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✓ Database connected successfully');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    throw error;
  }
}
