import { apiClient } from './client';
import type { ComparisonResult } from '../types';

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
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availableOnly?: boolean;
}

export interface KeywordSearchResponse {
  results: ComparisonResult[];
  count: number;
}

export const searchApi = {
  searchByKeyword: async (keyword: string, filters?: Omit<KeywordSearchRequest, 'keyword'>): Promise<ComparisonResult[]> => {
    const requestData: KeywordSearchRequest = { keyword, ...filters };
    console.log('API: Making keyword search request with:', requestData);
    const response = await apiClient.post<KeywordSearchResponse>('/search/keyword', requestData);
    console.log('API: Keyword search response status:', response.status);
    console.log('API: Keyword search response data:', response.data);
    return response.data.results;
  },

  searchByUrl: async (url: string, filters?: Omit<UrlSearchRequest, 'url'>): Promise<ComparisonResult> => {
    const requestData: UrlSearchRequest = { url, ...filters };
    console.log('API: Making URL search request with:', requestData);
    const response = await apiClient.post<KeywordSearchResponse>('/search/url', requestData);
    console.log('API: URL search response status:', response.status);
    console.log('API: URL search response data:', response.data);
    return response.data.results[0];
  },
};
