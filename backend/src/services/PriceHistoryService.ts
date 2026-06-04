import { PriceHistoryRepository } from '../repositories/PriceHistoryRepository';

export interface PriceSnapshot {
  id: number;
  productUrl: string;
  platform: string;
  price: number;
  currency: string;
  recordedAt: Date;
}

export class PriceHistoryService {
  private priceHistoryRepository: PriceHistoryRepository;

  constructor(priceHistoryRepository: PriceHistoryRepository) {
    this.priceHistoryRepository = priceHistoryRepository;
  }

  async recordPrice(productUrl: string, platform: string, price: number, currency = 'NGN'): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    const recentRecord = await this.priceHistoryRepository.findRecent(productUrl, platform, oneMinuteAgo);
    if (recentRecord && Math.abs(recentRecord.price - price) < 0.01) return;

    try {
      await this.priceHistoryRepository.create({ productUrl, platform, price, currency, recordedAt: now });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') return;
      throw error;
    }
  }

  async getPriceHistory(productUrl: string, platform?: string, days = 30): Promise<PriceSnapshot[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return this.priceHistoryRepository.findHistory(productUrl, platform, cutoffDate);
  }

  async cleanupOldData(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const result = await this.priceHistoryRepository.deleteOlderThan(cutoffDate);
    return result.count;
  }
}
