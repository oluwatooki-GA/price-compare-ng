import { PrismaClient, TrackedPriceHistory } from '@prisma/client';
import { Repository } from './base/Repository';
import { ITrackedPriceHistoryRepository } from './interfaces/ITrackedPriceHistoryRepository';

export class TrackedPriceHistoryRepository extends Repository<TrackedPriceHistory> implements ITrackedPriceHistoryRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async create(data: {
    trackedProductId: number;
    price: number;
    currency?: string;
    availability?: boolean;
  }): Promise<TrackedPriceHistory> {
    return this.prisma.trackedPriceHistory.create({ data });
  }

  async findByTrackedProductId(trackedProductId: number, limit = 90): Promise<TrackedPriceHistory[]> {
    return this.prisma.trackedPriceHistory.findMany({
      where: { trackedProductId },
      orderBy: { recordedAt: 'asc' },
      take: limit,
    });
  }

  async findLatest(trackedProductId: number): Promise<TrackedPriceHistory | null> {
    return this.prisma.trackedPriceHistory.findFirst({
      where: { trackedProductId },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
