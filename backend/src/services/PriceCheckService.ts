import { Queue } from 'bullmq';
import { ScraperRegistry } from '../scrapers/registry';
import { TrackedProductRepository } from '../repositories/TrackedProductRepository';
import { TrackedPriceHistoryRepository } from '../repositories/TrackedPriceHistoryRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AlertJobData } from '../queue/types';

export class PriceCheckService {
  constructor(
    private scraperRegistry: ScraperRegistry,
    private trackedProductRepository: TrackedProductRepository,
    private trackedPriceHistoryRepository: TrackedPriceHistoryRepository,
    private userRepository: UserRepository,
    private notificationQueue: Queue<AlertJobData>,
  ) {}

  async checkPrice(trackedProductId: number): Promise<void> {
    const tracked = await this.trackedProductRepository.findById(trackedProductId);
    if (!tracked || !tracked.isActive) return;

    const scraper = this.scraperRegistry.getScraperByPlatform(tracked.platform);
    if (!scraper) {
      console.warn(`[PriceCheckService] No scraper for platform: ${tracked.platform}`);
      return;
    }

    let product;
    try {
      product = await scraper.getProductByUrl(tracked.productUrl);
    } catch (err) {
      console.error(`[PriceCheckService] Failed to scrape ${tracked.productUrl}:`, err instanceof Error ? err.message : String(err));
      await this.trackedProductRepository.update(tracked.id, { lastCheckedAt: new Date() });
      return;
    }

    const newPrice = product.price;
    const currency = product.currency || 'NGN';

    await this.trackedPriceHistoryRepository.create({
      trackedProductId: tracked.id,
      price: newPrice,
      currency,
      availability: product.availability,
    });

    await this.trackedProductRepository.update(tracked.id, {
      lastKnownPrice: newPrice,
      lastCheckedAt: new Date(),
      productName: product.name || tracked.productName,
      imageUrl: product.imageUrl ?? tracked.imageUrl ?? undefined,
    });

    if (
      tracked.alertEnabled &&
      tracked.alertThreshold !== null &&
      tracked.alertThreshold !== undefined &&
      newPrice <= tracked.alertThreshold
    ) {
      const user = await this.userRepository.findById(tracked.userId);
      if (user) {
        await this.notificationQueue.add('price-alert', {
          trackedProductId: tracked.id,
          userEmail: user.email,
          productName: product.name || tracked.productName,
          productUrl: tracked.productUrl,
          platform: tracked.platform,
          newPrice,
          threshold: tracked.alertThreshold,
          currency,
        });
      }
    }
  }
}
