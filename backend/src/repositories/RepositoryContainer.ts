import { PrismaClient } from '@prisma/client';
import { UserRepository } from './UserRepository';
import { SavedComparisonRepository } from './SavedComparisonRepository';
import { PriceHistoryRepository } from './PriceHistoryRepository';

/**
 * Central container for all repository instances
 * Provides dependency injection for services
 */
export class RepositoryContainer {
  private static instance: RepositoryContainer;

  private prisma: PrismaClient;
  private userRepository: UserRepository;
  private savedComparisonRepository: SavedComparisonRepository;
  private priceHistoryRepository: PriceHistoryRepository;

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.userRepository = new UserRepository(prisma);
    this.savedComparisonRepository = new SavedComparisonRepository(prisma);
    this.priceHistoryRepository = new PriceHistoryRepository(prisma);
  }

  static getInstance(prisma: PrismaClient): RepositoryContainer {
    if (!RepositoryContainer.instance) {
      RepositoryContainer.instance = new RepositoryContainer(prisma);
    }
    return RepositoryContainer.instance;
  }

  getUserRepository(): UserRepository {
    return this.userRepository;
  }

  getSavedComparisonRepository(): SavedComparisonRepository {
    return this.savedComparisonRepository;
  }

  getPriceHistoryRepository(): PriceHistoryRepository {
    return this.priceHistoryRepository;
  }

  /**
   * Create repositories with transactional Prisma client
   * Use this for operations that need to span multiple repositories
   */
  withTransaction(tx: PrismaClient): RepositoryContainer {
    return new RepositoryContainer(tx);
  }
}
