import { TrackedPriceHistory } from '@prisma/client';

export interface ITrackedPriceHistoryRepository {
  create(data: {
    trackedProductId: number;
    price: number;
    currency?: string;
    availability?: boolean;
  }): Promise<TrackedPriceHistory>;

  findByTrackedProductId(trackedProductId: number, limit?: number): Promise<TrackedPriceHistory[]>;
  findLatest(trackedProductId: number): Promise<TrackedPriceHistory | null>;
}
