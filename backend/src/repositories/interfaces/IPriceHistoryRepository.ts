import { PriceHistory } from '@prisma/client';

export interface IPriceHistoryRepository {
  create(data: {
    productUrl: string;
    platform: string;
    price: number;
    currency: string;
    recordedAt: Date;
  }): Promise<PriceHistory>;

  findByProductAndPlatform(productUrl: string, platform: string): Promise<PriceHistory[]>;
  findRecent(productUrl: string, platform: string, since: Date): Promise<PriceHistory | null>;
  findHistory(productUrl: string, platform?: string, since?: Date): Promise<PriceHistory[]>;
  deleteOlderThan(date: Date): Promise<{ count: number }>;
}
