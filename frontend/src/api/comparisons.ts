import { apiClient } from './client';
import type { ComparisonResult, SavedComparison } from '../types';

export interface SaveComparisonRequest {
  comparisonData: ComparisonResult;
}

export const comparisonsApi = {
  saveComparison: async (data: SaveComparisonRequest): Promise<SavedComparison> => {
    const response = await apiClient.post('/comparisons', data);
    return response.data;
  },

  getUserComparisons: async (): Promise<SavedComparison[]> => {
    const response = await apiClient.get('/comparisons');
    return response.data;
  },

  deleteComparison: async (id: number): Promise<void> => {
    await apiClient.delete(`/comparisons/${id}`);
  },
};
