import { Router, Request, Response, NextFunction } from 'express';
import { ComparisonService } from './service';
import { SaveComparisonRequestSchema } from './schemas';
import { ValidationError } from '../../../shared/errors';
import { authenticateToken } from '../auth/routes';
import { authenticatedLimiter } from '../../../middleware/rateLimiter';
import { prisma } from '../../../config/database';

const router = Router();
const comparisonService = new ComparisonService(prisma);

/**
 * Extended Request interface with user property
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

/**
 * POST /comparisons
 * Save a comparison result for the authenticated user
 * Protected route - requires valid JWT token
 * Rate limited: 60 requests per minute per user (authenticated)
 * 
 * Validates: Requirements 7.1, 7.4
 */
router.post(
  '/',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      // Validate request body
      const validationResult = SaveComparisonRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }

      const { comparisonData } = validationResult.data;

      // Save the comparison
      const savedComparison = await comparisonService.saveComparison(
        req.user.userId,
        comparisonData
      );

      res.status(201).json(savedComparison);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /comparisons
 * Retrieve all saved comparisons for the authenticated user
 * Protected route - requires valid JWT token
 * Rate limited: 60 requests per minute per user (authenticated)
 * 
 * Validates: Requirements 7.2
 */
router.get(
  '/',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      // Retrieve user's saved comparisons
      const comparisons = await comparisonService.getUserComparisons(req.user.userId);

      res.status(200).json(comparisons);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /comparisons/:id
 * Delete a specific saved comparison
 * Protected route - requires valid JWT token
 * Rate limited: 60 requests per minute per user (authenticated)
 * 
 * Validates: Requirements 7.3
 */
router.delete(
  '/:id',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      // Parse comparison ID from URL parameter
      const comparisonId = parseInt(req.params.id, 10);

      if (isNaN(comparisonId)) {
        throw new ValidationError('Invalid comparison ID');
      }

      // Delete the comparison
      await comparisonService.deleteComparison(req.user.userId, comparisonId);

      res.status(200).json({
        success: true,
        message: 'Comparison deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as comparisonRouter };
