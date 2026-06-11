import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: ['error'],
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
    logger.info('Database connected');
  } catch (error) {
    logger.error({ err: error }, 'Database connection failed');
    throw error;
  }
}
