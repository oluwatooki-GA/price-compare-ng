import { ValidationError, ResourceNotFoundError } from '../../../shared/errors';
import { ComparisonResultResponse } from '../search/schemas';
import { SavedComparisonResponse } from './schemas';
import { SavedComparisonRepository } from '../../../repositories/SavedComparisonRepository';

/**
 * ComparisonService handles saving, retrieving, and deleting user comparison results
 *
 * - Save comparison results for authenticated users
 * - Retrieve saved comparisons for users
 * - Delete saved comparisons
 * - Enforce 50-comparison limit per user
 */
export class ComparisonService {
  private savedComparisonRepository: SavedComparisonRepository;

  constructor(savedComparisonRepository: SavedComparisonRepository) {
    this.savedComparisonRepository = savedComparisonRepository;
  }

  /**
   * Save a comparison result for a user
   * Enforces a maximum of 50 saved comparisons per user
   * Prevents duplicate saves of the same product URL per user
   *
   * @param userId - The ID of the user saving the comparison
   * @param comparison - The comparison result to save
   * @returns The saved comparison with ID and metadata
   * @throws ValidationError if user has reached the 50-comparison limit or product already saved
   */
  async saveComparison(
    userId: number,
    comparison: ComparisonResultResponse
  ): Promise<SavedComparisonResponse> {
    // Extract the main product URL for duplicate checking
    const productUrl = comparison.products?.[0]?.url;
    if (!productUrl) {
      throw new ValidationError('Invalid comparison data: no product URL found');
    }

    // Check if this product is already saved by this user
    const existingComparison = await this.savedComparisonRepository.findByUserAndProduct(
      userId,
      productUrl
    );

    if (existingComparison) {
      throw new ValidationError('This product comparison is already saved');
    }

    // Check current comparison count for user
    const currentCount = await this.savedComparisonRepository.countByUserId(userId);

    // Enforce 50-comparison limit (Requirement 7.4)
    if (currentCount >= 50) {
      throw new ValidationError(
        'Maximum of 50 saved comparisons reached. Please delete some comparisons before saving new ones.'
      );
    }

    // Determine search type based on comparison query
    const searchType = this.determineSearchType(comparison.searchQuery);

    try {
      // Save the comparison
      const savedComparison = await this.savedComparisonRepository.create({
        userId,
        searchQuery: comparison.searchQuery,
        searchType,
        comparisonData: JSON.stringify(comparison),
        productUrl,
      });

      // Return formatted response
      return {
        id: savedComparison.id,
        searchQuery: savedComparison.searchQuery,
        searchType: savedComparison.searchType,
        comparisonData: JSON.parse(savedComparison.comparisonData) as ComparisonResultResponse,
        createdAt: savedComparison.createdAt,
      };
    } catch (error: any) {
      // Handle unique constraint violations gracefully
      if (error.code === 'P2002') {
        throw new ValidationError('This product comparison is already saved');
      }
      throw error;
    }
  }

  /**
   * Retrieve all saved comparisons for a user
   *
   * @param userId - The ID of the user
   * @returns Array of saved comparisons ordered by creation date (newest first)
   */
  async getUserComparisons(userId: number): Promise<SavedComparisonResponse[]> {
    const savedComparisons = await this.savedComparisonRepository.findByUserId(userId);

    return savedComparisons.map((comparison) => {
      return {
        id: comparison.id,
        searchQuery: comparison.searchQuery,
        searchType: comparison.searchType,
        comparisonData: JSON.parse(comparison.comparisonData) as ComparisonResultResponse,
        createdAt: comparison.createdAt,
      };
    });
  }

  /**
   * Delete a saved comparison
   * Verifies that the comparison belongs to the user before deletion
   *
   * @param userId - The ID of the user
   * @param comparisonId - The ID of the comparison to delete
   * @returns true if deletion was successful
   * @throws ResourceNotFoundError if comparison doesn't exist or doesn't belong to user
   */
  async deleteComparison(userId: number, comparisonId: number): Promise<boolean> {
    // Verify the comparison exists and belongs to the user
    const comparison = await this.savedComparisonRepository.findById(comparisonId);

    if (!comparison) {
      throw new ResourceNotFoundError(`Comparison with ID ${comparisonId} not found`);
    }

    if (comparison.userId !== userId) {
      throw new ResourceNotFoundError(`Comparison with ID ${comparisonId} not found`);
    }

    // Delete the comparison
    await this.savedComparisonRepository.delete(comparisonId);

    return true;
  }

  /**
   * Determine search type based on the search query
   *
   * @param searchQuery - The search query string
   * @returns 'url' if query looks like a URL, 'keyword' otherwise
   */
  private determineSearchType(searchQuery: string): string {
    // Simple heuristic: if it starts with http:// or https://, it's a URL search
    return searchQuery.startsWith('http://') || searchQuery.startsWith('https://')
      ? 'url'
      : 'keyword';
  }
}
