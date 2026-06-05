import { apiClient } from './client';
import type { JobResponse } from '../types';

export interface KeywordSearchRequest {
  keyword: string;
  minPrice?: number;
  maxPrice?: number;
  platforms?: string[];
  minRating?: number;
  availableOnly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'name';
  limit?: number;
}

export interface UrlSearchRequest {
  url: string;
}

export const searchApi = {
  searchByKeyword: async (
    keyword: string,
    filters?: Omit<KeywordSearchRequest, 'keyword'>,
  ): Promise<JobResponse> => {
    console.log('API: keyword search', keyword, filters);
    const res = await apiClient.post<JobResponse>('/search/keyword', { keyword, ...filters });
    return res.data;
  },

  searchByUrl: async (url: string): Promise<JobResponse> => {
    console.log('API: url search', url);
    const res = await apiClient.post<JobResponse>('/search/url', { url });
    return res.data;
  },

  getJobStatus: async (jobId: string): Promise<JobResponse> => {
    const res = await apiClient.get<JobResponse>(`/jobs/${jobId}`);
    return res.data;
  },
};
