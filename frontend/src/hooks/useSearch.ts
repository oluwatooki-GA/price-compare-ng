import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { searchApi } from '../api/search';
import type { ComparisonResult } from '../types';

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

interface UrlSearchParams {
  url: string;
}

export type JobPhase = 'idle' | 'queued' | 'scraping';

export const useSearch = () => {
  const [jobPhase, setJobPhase] = useState<JobPhase>('idle');

  // Poll GET /jobs/:jobId every 2 s until the job settles
  async function pollUntilDone(jobId: string): Promise<ComparisonResult[]> {
    while (true) {
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
      const job = await searchApi.getJobStatus(jobId);
      if (job.status === 'RUNNING')    setJobPhase('scraping');
      if (job.status === 'COMPLETED')  return job.results ?? [];
      if (job.status === 'FAILED')     throw new Error(job.error ?? 'Search failed');
    }
  }

  const searchByKeyword = useMutation<ComparisonResult[], Error, KeywordSearchParams>({
    mutationFn: async ({ keyword, ...filters }: KeywordSearchParams) => {
      console.log('Searching by keyword:', keyword, 'with filters:', filters);
      setJobPhase('queued');

      const response = await searchApi.searchByKeyword(keyword, filters);
      console.log('Keyword search job response:', response);

      // Immediate cache hit — no polling needed
      if (response.results) {
        setJobPhase('idle');
        return response.results;
      }

      const results = await pollUntilDone(response.jobId);
      setJobPhase('idle');
      return results;
    },
    onError: () => setJobPhase('idle'),
  });

  const searchByUrl = useMutation<ComparisonResult[], Error, UrlSearchParams>({
    mutationFn: async ({ url }: UrlSearchParams) => {
      console.log('Searching by URL:', url);
      setJobPhase('queued');

      const response = await searchApi.searchByUrl(url);
      console.log('URL search job response:', response);

      if (response.results) {
        setJobPhase('idle');
        return response.results;
      }

      const results = await pollUntilDone(response.jobId);
      setJobPhase('idle');
      return results;
    },
    onError: () => setJobPhase('idle'),
  });

  return { searchByKeyword, searchByUrl, jobPhase };
};
