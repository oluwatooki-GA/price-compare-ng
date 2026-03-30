import { PrismaClient, PriceHistory } from '@prisma/client';
import { Repository } from './base/Repository';
import { IPriceHistoryRepository } from '../interfaces/IPriceHistoryRepository';

export class PriceHistoryRepository extends Repository<PriceHistory> implements IPriceHistoryRepository {
  async create(data: {
    productUrl: string;
    platform: string;
    price: number;
    currency: string;
    recordedAt: Date;
  }): Promise<PriceHistory> {
    return this.prisma.priceHistory.create({
      data: {
        productUrl: data.productUrl,
        platform: data.platform,
        price: data.price,
        currency: data.currency,
        recordedAt: data.recordedAt,
      },
    });
  }

  async findByProductAndPlatform(productUrl: string, platform: string): Promise<PriceHistory[]> {
    return this.prisma.priceHistory.findMany({
      where: {
        productUrl,
        platform,
      },
    });
  }

  async findRecent(productUrl: string, platform: string, since: Date): Promise<PriceHistory | null> {
    return this.prisma.priceHistory.findFirst({
      where: {
        productUrl,
        platform,
        recordedAt: {
          gte: since,
        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
    });
  }

  async findHistory(productUrl: string, platform?: string, since?: Date): Promise<PriceHistory[]> {
    const whereClause: any = {
      productUrl,
    };

    if (platform) {
      whereClause.platform = platform;
    }

    if (since) {
      whereClause.recordedAt = {
        gte: since,
      };
    }

    return this.prisma.priceHistory.findMany({
      where: whereClause,
      orderBy: {
        recordedAt: 'asc',
      },
    });
  }

  async deleteOlderThan(date: Date): Promise<{ count: number }> {
    return this.prisma.priceHistory.deleteMany({
      where: {
        recordedAt: {
          lt: date,
        },
      },
    });
  }
}
