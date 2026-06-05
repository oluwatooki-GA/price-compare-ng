import { apiClient } from './client';
import type { TrackedProduct, TrackedPriceHistoryEntry, DashboardSummary } from '../types';

export interface TrackProductRequest {
  productUrl: string;
  productName: string;
  platform: string;
  imageUrl?: string | null;
  currentPrice?: number;
  alertThreshold?: number;
  alertEnabled?: boolean;
}

export interface UpdateAlertSettingsRequest {
  alertThreshold?: number;
  alertEnabled?: boolean;
}

export const trackedProductsApi = {
  trackProduct: async (data: TrackProductRequest): Promise<TrackedProduct> => {
    const response = await apiClient.post('/tracked-products', data);
    return response.data;
  },

  getTrackedProducts: async (): Promise<TrackedProduct[]> => {
    const response = await apiClient.get('/tracked-products');
    return response.data;
  },

  getPriceHistory: async (id: number): Promise<TrackedPriceHistoryEntry[]> => {
    const response = await apiClient.get(`/tracked-products/${id}/price-history`);
    return response.data;
  },

  updateAlertSettings: async (id: number, data: UpdateAlertSettingsRequest): Promise<TrackedProduct> => {
    const response = await apiClient.patch(`/tracked-products/${id}`, data);
    return response.data;
  },

  deleteTrackedProduct: async (id: number): Promise<void> => {
    await apiClient.delete(`/tracked-products/${id}`);
  },

  getDashboard: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get('/dashboard');
    return response.data;
  },
};
