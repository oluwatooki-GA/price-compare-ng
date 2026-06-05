import { ValidationError, ResourceNotFoundError } from '../shared/errors';
import { ComparisonResultResponse } from '../api/v1/search/schemas';
import { SavedComparisonResponse } from '../api/v1/comparisons/schemas';
import { SavedComparisonRepository } from '../repositories/SavedComparisonRepository';

export class ComparisonService {
  private savedComparisonRepository: SavedComparisonRepository;

  constructor(savedComparisonRepository: SavedComparisonRepository) {
    this.savedComparisonRepository = savedComparisonRepository;
  }

  async saveComparison(userId: number, comparison: ComparisonResultResponse): Promise<SavedComparisonResponse> {
    const productUrl = comparison.products?.[0]?.url;
    if (!productUrl) throw new ValidationError('Invalid comparison data: no product URL found');

    const existingComparison = await this.savedComparisonRepository.findByUserAndProduct(userId, productUrl);
    if (existingComparison) throw new ValidationError('This product comparison is already saved');

    const currentCount = await this.savedComparisonRepository.countByUserId(userId);
    if (currentCount >= 50) {
      throw new ValidationError('Maximum of 50 saved comparisons reached. Please delete some comparisons before saving new ones.');
    }

    const searchType = this.determineSearchType(comparison.searchQuery);

    try {
      const savedComparison = await this.savedComparisonRepository.create({
        userId,
        searchQuery: comparison.searchQuery,
        searchType,
        comparisonData: JSON.stringify(comparison),
        productUrl,
      });
      return {
        id: savedComparison.id,
        searchQuery: savedComparison.searchQuery,
        searchType: savedComparison.searchType,
        comparisonData: JSON.parse(savedComparison.comparisonData) as ComparisonResultResponse,
        createdAt: savedComparison.createdAt,
      };
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ValidationError('This product comparison is already saved');
      }
      throw error;
    }
  }

  async getUserComparisons(userId: number): Promise<SavedComparisonResponse[]> {
    const savedComparisons = await this.savedComparisonRepository.findByUserId(userId);
    return savedComparisons.map(c => ({
      id: c.id,
      searchQuery: c.searchQuery,
      searchType: c.searchType,
      comparisonData: JSON.parse(c.comparisonData) as ComparisonResultResponse,
      createdAt: c.createdAt,
    }));
  }

  async deleteComparison(userId: number, comparisonId: number): Promise<boolean> {
    const comparison = await this.savedComparisonRepository.findById(comparisonId);
    if (!comparison) throw new ResourceNotFoundError(`Comparison with ID ${comparisonId} not found`);
    if (comparison.userId !== userId) throw new ResourceNotFoundError(`Comparison with ID ${comparisonId} not found`);
    await this.savedComparisonRepository.delete(comparisonId);
    return true;
  }

  private determineSearchType(searchQuery: string): string {
    return searchQuery.startsWith('http://') || searchQuery.startsWith('https://') ? 'url' : 'keyword';
  }
}
