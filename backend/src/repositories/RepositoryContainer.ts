import { PrismaClient } from '@prisma/client';
import { UserRepository } from './UserRepository';
import { SavedComparisonRepository } from './SavedComparisonRepository';
import { PriceHistoryRepository } from './PriceHistoryRepository';
import { ScrapeJobRepository } from './ScrapeJobRepository';
import { TrackedProductRepository } from './TrackedProductRepository';
import { TrackedPriceHistoryRepository } from './TrackedPriceHistoryRepository';

export class RepositoryContainer {
  private static instance: RepositoryContainer;

  private userRepository: UserRepository;
  private savedComparisonRepository: SavedComparisonRepository;
  private priceHistoryRepository: PriceHistoryRepository;
  private scrapeJobRepository: ScrapeJobRepository;
  private trackedProductRepository: TrackedProductRepository;
  private trackedPriceHistoryRepository: TrackedPriceHistoryRepository;

  private constructor(prisma: PrismaClient) {
    this.userRepository = new UserRepository(prisma);
    this.savedComparisonRepository = new SavedComparisonRepository(prisma);
    this.priceHistoryRepository = new PriceHistoryRepository(prisma);
    this.scrapeJobRepository = new ScrapeJobRepository(prisma);
    this.trackedProductRepository = new TrackedProductRepository(prisma);
    this.trackedPriceHistoryRepository = new TrackedPriceHistoryRepository(prisma);
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

  getScrapeJobRepository(): ScrapeJobRepository {
    return this.scrapeJobRepository;
  }

  getTrackedProductRepository(): TrackedProductRepository {
    return this.trackedProductRepository;
  }

  getTrackedPriceHistoryRepository(): TrackedPriceHistoryRepository {
    return this.trackedPriceHistoryRepository;
  }

  withTransaction(tx: PrismaClient): RepositoryContainer {
    return new RepositoryContainer(tx);
  }
}
