import { z } from 'zod';
import { ComparisonResultResponseSchema } from '../search/schemas';

// Request schemas
export const SaveComparisonRequestSchema = z.object({
  comparisonData: ComparisonResultResponseSchema
});

// Response schemas
export const SavedComparisonResponseSchema = z.object({
  id: z.number(),
  searchQuery: z.string(),
  searchType: z.string(),
  comparisonData: ComparisonResultResponseSchema,
  createdAt: z.coerce.date()
});

// Type exports
export type SaveComparisonRequest = z.infer<typeof SaveComparisonRequestSchema>;
export type SavedComparisonResponse = z.infer<typeof SavedComparisonResponseSchema>;
