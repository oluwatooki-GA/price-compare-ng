import { PrismaClient, SavedComparison } from '@prisma/client';
import { Repository } from './base/Repository';
import { ISavedComparisonRepository } from '../interfaces/ISavedComparisonRepository';

export class SavedComparisonRepository extends Repository<SavedComparison> implements ISavedComparisonRepository {
  async create(data: {
    userId: number;
    searchQuery: string;
    searchType: string;
    comparisonData: string;
    productUrl: string;
  }): Promise<SavedComparison> {
    return this.prisma.savedComparison.create({
      data: {
        userId: data.userId,
        searchQuery: data.searchQuery,
        searchType: data.searchType,
        comparisonData: data.comparisonData,
        productUrl: data.productUrl,
      },
    });
  }

  async findByUserId(userId: number): Promise<SavedComparison[]> {
    return this.prisma.savedComparison.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number): Promise<SavedComparison | null> {
    return this.prisma.savedComparison.findUnique({
      where: { id },
    });
  }

  async findByUserAndProduct(userId: number, productUrl: string): Promise<SavedComparison | null> {
    return this.prisma.savedComparison.findUnique({
      where: {
        userId_productUrl: {
          userId,
          productUrl,
        },
      },
    });
  }

  async countByUserId(userId: number): Promise<number> {
    return this.prisma.savedComparison.count({
      where: { userId },
    });
  }

  async delete(id: number): Promise<SavedComparison> {
    return this.prisma.savedComparison.delete({
      where: { id },
    });
  }

  async existsByUserAndProduct(userId: number, productUrl: string): Promise<boolean> {
    const comparison = await this.findByUserAndProduct(userId, productUrl);
    return comparison !== null;
  }
}
