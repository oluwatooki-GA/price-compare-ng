import { TrackedProduct, TrackedPriceHistory } from '@prisma/client';
import { ValidationError, ResourceNotFoundError } from '../shared/errors';
import { TrackedProductRepository } from '../repositories/TrackedProductRepository';
import { TrackedPriceHistoryRepository } from '../repositories/TrackedPriceHistoryRepository';

export interface TrackedProductWithHistory extends TrackedProduct {
  priceHistory: TrackedPriceHistory[];
}

export class TrackedProductService {
  constructor(
    private trackedProductRepository: TrackedProductRepository,
    private trackedPriceHistoryRepository: TrackedPriceHistoryRepository,
  ) {}

  async trackProduct(userId: number, data: {
    productUrl: string;
    productName: string;
    platform: string;
    imageUrl?: string;
    currentPrice?: number;
    alertThreshold?: number;
    alertEnabled?: boolean;
  }): Promise<TrackedProductWithHistory> {
    const existing = await this.trackedProductRepository.findByUserAndUrl(userId, data.productUrl);
    if (existing) {
      if (!existing.isActive) {
        const reactivated = await this.trackedProductRepository.update(existing.id, { isActive: true });
        const priceHistory = await this.trackedPriceHistoryRepository.findByTrackedProductId(existing.id);
        return { ...reactivated, priceHistory };
      }
      throw new ValidationError('You are already tracking this product');
    }

    const tracked = await this.trackedProductRepository.create({
      userId,
      productUrl: data.productUrl,
      productName: data.productName,
      platform: data.platform,
      imageUrl: data.imageUrl,
      lastKnownPrice: data.currentPrice,
      alertThreshold: data.alertThreshold,
      alertEnabled: data.alertEnabled ?? false,
    });

    if (data.currentPrice !== undefined) {
      await this.trackedPriceHistoryRepository.create({
        trackedProductId: tracked.id,
        price: data.currentPrice,
        currency: 'NGN',
        availability: true,
      });
    }

    const priceHistory = await this.trackedPriceHistoryRepository.findByTrackedProductId(tracked.id);
    return { ...tracked, priceHistory };
  }

  async getUserTrackedProducts(userId: number): Promise<TrackedProductWithHistory[]> {
    const tracked = await this.trackedProductRepository.findByUserId(userId);
    return Promise.all(
      tracked.map(async (tp) => {
        const priceHistory = await this.trackedPriceHistoryRepository.findByTrackedProductId(tp.id);
        return { ...tp, priceHistory };
      }),
    );
  }

  async getPriceHistory(userId: number, trackedProductId: number): Promise<TrackedPriceHistory[]> {
    const tracked = await this.trackedProductRepository.findById(trackedProductId);
    if (!tracked) throw new ResourceNotFoundError('Tracked product not found');
    if (tracked.userId !== userId) throw new ResourceNotFoundError('Tracked product not found');
    return this.trackedPriceHistoryRepository.findByTrackedProductId(trackedProductId);
  }

  async updateAlertSettings(userId: number, trackedProductId: number, data: {
    alertThreshold?: number;
    alertEnabled?: boolean;
  }): Promise<TrackedProduct> {
    const tracked = await this.trackedProductRepository.findById(trackedProductId);
    if (!tracked) throw new ResourceNotFoundError('Tracked product not found');
    if (tracked.userId !== userId) throw new ResourceNotFoundError('Tracked product not found');
    return this.trackedProductRepository.update(trackedProductId, data);
  }

  async deleteTrackedProduct(userId: number, trackedProductId: number): Promise<void> {
    const tracked = await this.trackedProductRepository.findById(trackedProductId);
    if (!tracked) throw new ResourceNotFoundError('Tracked product not found');
    if (tracked.userId !== userId) throw new ResourceNotFoundError('Tracked product not found');
    await this.trackedProductRepository.delete(trackedProductId);
  }

  async getDashboardSummary(userId: number): Promise<TrackedProductWithHistory[]> {
    return this.getUserTrackedProducts(userId);
  }
}
