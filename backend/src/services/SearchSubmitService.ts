import { Queue } from 'bullmq';
import { ValidationError, ResourceNotFoundError } from '../shared/errors';
import type { ScrapeJobData } from '../queue/types';
import type { ScrapeJobRepository } from '../repositories/ScrapeJobRepository';

const RECENT_JOB_WINDOW_MS = 5 * 60 * 1000;

export function buildFiltersKey(filters: Record<string, unknown>): string {
  return JSON.stringify({
    minPrice:      filters.minPrice      ?? null,
    maxPrice:      filters.maxPrice      ?? null,
    platforms:     Array.isArray(filters.platforms)
                     ? [...(filters.platforms as string[])].sort()
                     : null,
    minRating:     filters.minRating     ?? null,
    availableOnly: filters.availableOnly ?? null,
    limit:         filters.limit         ?? null,
  });
}

export interface JobSubmitResult {
  jobId: string;
  status: string;
  results?: unknown[];
  count?: number;
}

export class SearchSubmitService {
  constructor(
    private jobRepository: ScrapeJobRepository,
    private queue: Queue,
  ) {}

  async submitKeyword(
    keyword: string,
    filters: ScrapeJobData['filters'],
  ): Promise<JobSubmitResult> {
    const query = keyword.trim().toLowerCase();
    if (query.length < 2) {
      throw new ValidationError('Search keyword must be at least 2 characters');
    }

    const filtersKey = buildFiltersKey(filters as Record<string, unknown>);

    const cached = await this.jobRepository.findRecentCompleted(query, 'keyword', filtersKey, RECENT_JOB_WINDOW_MS);
    if (cached) {
      const results = cached.results as unknown[];
      return { jobId: cached.id, status: 'COMPLETED', results, count: results.length };
    }

    const active = await this.jobRepository.findActive(query, 'keyword', filtersKey);
    if (active) return { jobId: active.id, status: active.status };

    const dbJob = await this.jobRepository.create({ query, queryType: 'keyword', filtersKey, status: 'PENDING' });
    const jobData: ScrapeJobData = { jobDbId: dbJob.id, query, queryType: 'keyword', filters };
    await this.queue.add('keyword', jobData, { jobId: dbJob.id });
    return { jobId: dbJob.id, status: 'PENDING' };
  }

  async submitUrl(url: string): Promise<JobSubmitResult> {
    const filtersKey = '{}';

    const cached = await this.jobRepository.findRecentCompleted(url, 'url', filtersKey, RECENT_JOB_WINDOW_MS);
    if (cached) {
      const results = cached.results as unknown[];
      return { jobId: cached.id, status: 'COMPLETED', results, count: results.length };
    }

    const active = await this.jobRepository.findActive(url, 'url', filtersKey);
    if (active) return { jobId: active.id, status: active.status };

    const dbJob = await this.jobRepository.create({ query: url, queryType: 'url', filtersKey, status: 'PENDING' });
    const jobData: ScrapeJobData = { jobDbId: dbJob.id, query: url, queryType: 'url', filters: {} };
    await this.queue.add('url', jobData, { jobId: dbJob.id });
    return { jobId: dbJob.id, status: 'PENDING' };
  }

  async getJobStatus(jobId: string): Promise<{
    jobId: string;
    status: string;
    results: unknown;
    error: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) throw new ResourceNotFoundError(`Job ${jobId} not found`);
    return {
      jobId:       job.id,
      status:      job.status,
      results:     job.results ?? null,
      error:       job.error ?? null,
      createdAt:   job.createdAt,
      completedAt: job.completedAt ?? null,
    };
  }
}
