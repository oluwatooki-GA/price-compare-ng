import { PrismaClient } from '@prisma/client';

/**
 * Transaction manager for handling multi-repository transactions
 */
export class TransactionManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Execute operations in a transaction
   * @param callback Function containing operations to execute transactionally
   * @returns Result of the callback
   */
  async execute<T>(
    callback: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  /**
   * Get a transactional Prisma client
   * Use this when you need to pass transaction context to repositories
   */
  getTransactionalClient(tx: PrismaClient): PrismaClient {
    return tx;
  }
}
