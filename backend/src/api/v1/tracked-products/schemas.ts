import { z } from 'zod';

export const TrackProductRequestSchema = z.object({
  productUrl: z.string().url('Invalid product URL'),
  productName: z.string().min(1, 'Product name is required'),
  platform: z.string().min(1, 'Platform is required'),
  imageUrl: z.string().url().optional().nullable(),
  currentPrice: z.number().positive().optional(),
  alertThreshold: z.number().positive().optional(),
  alertEnabled: z.boolean().optional(),
});

export const UpdateAlertSettingsSchema = z.object({
  alertThreshold: z.number().positive().optional(),
  alertEnabled: z.boolean().optional(),
});

export const TrackedPriceHistoryEntrySchema = z.object({
  id: z.number(),
  price: z.number(),
  currency: z.string(),
  availability: z.boolean(),
  recordedAt: z.coerce.date(),
});

export const TrackedProductResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  productUrl: z.string(),
  productName: z.string(),
  platform: z.string(),
  imageUrl: z.string().nullable(),
  lastKnownPrice: z.number().nullable(),
  alertThreshold: z.number().nullable(),
  alertEnabled: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastCheckedAt: z.coerce.date().nullable(),
  priceHistory: z.array(TrackedPriceHistoryEntrySchema),
});

export type TrackProductRequest = z.infer<typeof TrackProductRequestSchema>;
export type UpdateAlertSettings = z.infer<typeof UpdateAlertSettingsSchema>;
export type TrackedProductResponse = z.infer<typeof TrackedProductResponseSchema>;
export type TrackedPriceHistoryEntry = z.infer<typeof TrackedPriceHistoryEntrySchema>;
