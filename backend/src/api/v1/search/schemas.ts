import { z } from 'zod';

// Request schemas
export const KeywordSearchRequestSchema = z.object({
  keyword: z.string().min(2),
  // Optional filters
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  platforms: z.array(z.enum(['jumia', 'jiji', 'temu', 'konga'])).optional(),
  minRating: z.number().min(0).max(5).optional(),
  availableOnly: z.boolean().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'rating', 'name']).optional(),
  limit: z.number().min(1).max(50).optional()
});

export const UrlSearchRequestSchema = z.object({
  url: z.string().url(),
  // Optional filters for similar products
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minRating: z.number().min(0).max(5).optional(),
  availableOnly: z.boolean().optional()
});

// Response schemas
export const ProductDataResponseSchema = z.object({
  platform: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  rating: z.number().nullable(),
  reviewCount: z.number(),
  url: z.string(),
  availability: z.boolean(),
  imageUrl: z.string().nullable()
});

export const ComparisonResultResponseSchema = z.object({
  products: z.array(ProductDataResponseSchema),
  bestValueIndex: z.number(),
  searchQuery: z.string(),
  timestamp: z.coerce.date()
});

// Type exports
export type KeywordSearchRequest = z.infer<typeof KeywordSearchRequestSchema>;
export type UrlSearchRequest = z.infer<typeof UrlSearchRequestSchema>;
export type ProductDataResponse = z.infer<typeof ProductDataResponseSchema>;
export type ComparisonResultResponse = z.infer<typeof ComparisonResultResponseSchema>;
