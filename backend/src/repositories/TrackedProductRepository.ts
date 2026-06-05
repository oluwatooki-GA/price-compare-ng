import { PrismaClient, TrackedProduct } from '@prisma/client';
import { Repository } from './base/Repository';
import { ITrackedProductRepository } from './interfaces/ITrackedProductRepository';

export class TrackedProductRepository extends Repository<TrackedProduct> implements ITrackedProductRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async create(data: {
    userId: number;
    productUrl: string;
    productName: string;
    platform: string;
    imageUrl?: string;
    lastKnownPrice?: number;
    alertThreshold?: number;
    alertEnabled?: boolean;
  }): Promise<TrackedProduct> {
    return this.prisma.trackedProduct.create({ data });
  }

  async findByUserId(userId: number): Promise<TrackedProduct[]> {
    return this.prisma.trackedProduct.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number): Promise<TrackedProduct | null> {
    return this.prisma.trackedProduct.findUnique({ where: { id } });
  }

  async findByUserAndUrl(userId: number, productUrl: string): Promise<TrackedProduct | null> {
    return this.prisma.trackedProduct.findUnique({
      where: { userId_productUrl: { userId, productUrl } },
    });
  }

  async findAllActive(limit = 100, offset = 0): Promise<TrackedProduct[]> {
    return this.prisma.trackedProduct.findMany({
      where: { isActive: true },
      take: limit,
      skip: offset,
      orderBy: { id: 'asc' },
    });
  }

  async countActive(): Promise<number> {
    return this.prisma.trackedProduct.count({ where: { isActive: true } });
  }

  async update(id: number, data: {
    productName?: string;
    imageUrl?: string;
    lastKnownPrice?: number;
    alertThreshold?: number;
    alertEnabled?: boolean;
    isActive?: boolean;
    lastCheckedAt?: Date;
  }): Promise<TrackedProduct> {
    return this.prisma.trackedProduct.update({ where: { id }, data });
  }

  async delete(id: number): Promise<TrackedProduct> {
    return this.prisma.trackedProduct.delete({ where: { id } });
  }
}
