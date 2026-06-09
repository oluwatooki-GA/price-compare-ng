import { TrackedProduct } from '@prisma/client';

export interface ITrackedProductRepository {
  create(data: {
    userId: number;
    productUrl: string;
    productName: string;
    platform: string;
    imageUrl?: string;
    lastKnownPrice?: number;
    alertThreshold?: number;
    alertEnabled?: boolean;
  }): Promise<TrackedProduct>;

  findByUserId(userId: number): Promise<TrackedProduct[]>;
  findById(id: number): Promise<TrackedProduct | null>;
  findByUserAndUrl(userId: number, productUrl: string): Promise<TrackedProduct | null>;
  findAllActive(limit?: number, offset?: number): Promise<TrackedProduct[]>;
  countActive(): Promise<number>;

  update(id: number, data: {
    productName?: string;
    imageUrl?: string;
    lastKnownPrice?: number;
    alertThreshold?: number;
    alertEnabled?: boolean;
    isActive?: boolean;
    lastCheckedAt?: Date;
  }): Promise<TrackedProduct>;

  delete(id: number): Promise<TrackedProduct>;
}
