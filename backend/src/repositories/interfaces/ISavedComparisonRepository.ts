import { SavedComparison } from '@prisma/client';

export interface ISavedComparisonRepository {
  create(data: {
    userId: number;
    searchQuery: string;
    searchType: string;
    comparisonData: string;
    productUrl: string;
  }): Promise<SavedComparison>;

  findByUserId(userId: number): Promise<SavedComparison[]>;
  findById(id: number): Promise<SavedComparison | null>;
  findByUserAndProduct(userId: number, productUrl: string): Promise<SavedComparison | null>;
  countByUserId(userId: number): Promise<number>;
  delete(id: number): Promise<SavedComparison>;
  existsByUserAndProduct(userId: number, productUrl: string): Promise<boolean>;
}
