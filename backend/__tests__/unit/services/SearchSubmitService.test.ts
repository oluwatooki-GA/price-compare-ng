import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SearchSubmitService } from '../../../src/services/SearchSubmitService';
import { ValidationError } from '../../../src/shared/errors';
import type { ScrapeJobRepository } from '../../../src/repositories/ScrapeJobRepository';
import type { Queue } from 'bullmq';

const mockJobRepo = {
  findRecentCompleted: vi.fn(),
  findActive:          vi.fn(),
  create:              vi.fn(),
  findById:            vi.fn(),
  updateStatus:        vi.fn(),
} as unknown as ScrapeJobRepository;

const mockQueue = { add: vi.fn() } as unknown as Queue;

describe('SearchSubmitService', () => {
  let service: SearchSubmitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SearchSubmitService(mockJobRepo, mockQueue);
  });

  test('returns cached job immediately if a completed job for the same query exists within 5 minutes', async () => {
    const cachedResults = [{ products: [{ name: 'iPhone', price: 300000 }] }];
    (mockJobRepo.findRecentCompleted as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cached-job-1',
      status: 'COMPLETED',
      results: cachedResults,
    });

    const result = await service.submitKeyword('iphone', {});

    expect(result.jobId).toBe('cached-job-1');
    expect(result.status).toBe('COMPLETED');
    expect(result.results).toEqual(cachedResults);
    expect(mockJobRepo.create).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  test('returns existing job if a job for the same query is already PENDING or RUNNING', async () => {
    (mockJobRepo.findRecentCompleted as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockJobRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'active-job-2',
      status: 'RUNNING',
    });

    const result = await service.submitKeyword('iphone', {});

    expect(result.jobId).toBe('active-job-2');
    expect(result.status).toBe('RUNNING');
    expect(mockJobRepo.create).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  test('creates a new job and publishes to BullMQ if no existing job found', async () => {
    (mockJobRepo.findRecentCompleted as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockJobRepo.findActive as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockJobRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-job-3', status: 'PENDING' });
    (mockQueue.add as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await service.submitKeyword('iphone', { limit: 10 });

    expect(result.jobId).toBe('new-job-3');
    expect(result.status).toBe('PENDING');
    expect(mockJobRepo.create).toHaveBeenCalledOnce();
    expect(mockQueue.add).toHaveBeenCalledOnce();
    expect(mockQueue.add).toHaveBeenCalledWith(
      'keyword',
      expect.objectContaining({ jobDbId: 'new-job-3', query: 'iphone', queryType: 'keyword' }),
      expect.objectContaining({ jobId: 'new-job-3' }),
    );
  });

  test('throws a ValidationError if keyword is under 2 characters', async () => {
    await expect(service.submitKeyword('a', {})).rejects.toThrow(ValidationError);
    await expect(service.submitKeyword('', {})).rejects.toThrow(ValidationError);
    await expect(service.submitKeyword(' ', {})).rejects.toThrow(ValidationError);
    expect(mockJobRepo.findRecentCompleted).not.toHaveBeenCalled();
  });
});
