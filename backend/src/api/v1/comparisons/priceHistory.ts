import { PrismaClient } from '@prisma/client';

/**
 * Interface for price snapshot data
 */
export interface PriceSnapshot {
  id: number;
  productUrl: string;
  platform: string;
  price: number;
  currency: string;
  recordedAt: Date;
}

/**
 * Service for managing price history data
 *
 * Responsibilities:
 * - Store price snapshots with timestamps
 * - Retrieve historical data for trend analysis
 * - Clean up old data (retain 90 days)
 */
export class PriceHistoryService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Store price snapshot with current timestamp
   * Prevents duplicate entries for the same product/platform within the same minute
   * 
   * @param productUrl - The URL of the product
   * @param platform - The platform name (e.g., 'jumia', 'konga')
   * @param price - The price value
   * @param currency - The currency code (e.g., 'NGN')
   * @returns Promise<void>
   * 
   * Validates: Requirement 6.1 - Price history is recorded on retrieval
   */
  async recordPrice(
    productUrl: string,
    platform: string,
    price: number,
    currency: string = 'NGN'
  ): Promise<void> {
    const now = new Date();
    
    // Check if we already have a price record for this product/platform in the last minute
    // This prevents duplicate entries from rapid successive searches
    const recentRecord = await this.prisma.priceHistory.findFirst({
      where: {
        productUrl,
        platform,
        recordedAt: {
          gte: new Date(now.getTime() - 60000), // Last minute
        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
    });

    // If we have a recent record with the same price, skip saving
    if (recentRecord && Math.abs(recentRecord.price - price) < 0.01) {
      console.log(`Skipping duplicate price record for ${platform} product: ${productUrl}`);
      return;
    }

    try {
      await this.prisma.priceHistory.create({
        data: {
          productUrl,
          platform,
          price,
          currency,
          recordedAt: now,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violations gracefully
      if (error.code === 'P2002') {
        console.log(`Price already recorded for ${platform} product: ${productUrl}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Retrieve price history for specified period
   * 
   * @param productUrl - The URL of the product
   * @param platform - The platform name (optional, if not provided returns all platforms)
   * @param days - Number of days to retrieve (default: 30)
   * @returns Promise<PriceSnapshot[]> - Array of price snapshots
   * 
   * Validates: Requirement 6.2 - Price history retrieval returns associated data
   */
  async getPriceHistory(
    productUrl: string,
    platform?: string,
    days: number = 30
  ): Promise<PriceSnapshot[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const whereClause: any = {
      productUrl,
      recordedAt: {
        gte: cutoffDate,
      },
    };

    if (platform) {
      whereClause.platform = platform;
    }

    const records = await this.prisma.priceHistory.findMany({
      where: whereClause,
      orderBy: {
        recordedAt: 'asc',
      },
    });

    return records;
  }

  /**
   * Remove price data older than 90 days
   * 
   * @returns Promise<number> - Count of deleted records
   * 
   * Validates: Requirement 6.4 - 90-day retention policy
   */
  async cleanupOldData(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await this.prisma.priceHistory.deleteMany({
      where: {
        recordedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
