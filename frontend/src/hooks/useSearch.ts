import { useMutation } from '@tanstack/react-query';
import { searchApi } from '../api/search';

interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  platforms?: string[];
  minRating?: number;
  availableOnly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'name';
  limit?: number;
}

interface KeywordSearchParams extends SearchFilters {
  keyword: string;
}

interface UrlSearchParams extends Omit<SearchFilters, 'platforms' | 'sortBy' | 'limit'> {
  url: string;
}

export const useSearch = () => {
  const searchByKeyword = useMutation({
    mutationFn: async ({ keyword, ...filters }: KeywordSearchParams) => {
      console.log('Searching by keyword:', keyword, 'with filters:', filters);
      const result = await searchApi.searchByKeyword(keyword, filters);
      console.log('Keyword search API response:', result);
      return result;
    },
  });

  const searchByUrl = useMutation({
    mutationFn: async ({ url, ...filters }: UrlSearchParams) => {
      console.log('Searching by URL:', url, 'with filters:', filters);
      const result = await searchApi.searchByUrl(url, filters);
      console.log('URL search API response:', result);
      return result;
    },
  });

  return {
    searchByKeyword,
    searchByUrl,
  };
};
