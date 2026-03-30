import { PrismaClient } from '@prisma/client';

/**
 * Base repository class providing common patterns for all repositories
 * All repositories should extend this class
 */
export abstract class Repository<T> {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
}
