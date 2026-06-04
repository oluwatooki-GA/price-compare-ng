import { ScrapeJob, JobStatus, Prisma } from '@prisma/client';
import { Repository } from './base/Repository';

export class ScrapeJobRepository extends Repository<ScrapeJob> {
  async findRecentCompleted(
    query: string,
    queryType: string,
    filtersKey: string,
    windowMs: number,
  ): Promise<ScrapeJob | null> {
    return this.prisma.scrapeJob.findFirst({
      where: {
        query,
        queryType,
        filtersKey,
        status: 'COMPLETED',
        completedAt: { gte: new Date(Date.now() - windowMs) },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findActive(
    query: string,
    queryType: string,
    filtersKey: string,
  ): Promise<ScrapeJob | null> {
    return this.prisma.scrapeJob.findFirst({
      where: { query, queryType, filtersKey, status: { in: ['PENDING', 'RUNNING'] } },
    });
  }

  async create(data: {
    query: string;
    queryType: string;
    filtersKey: string;
    status: JobStatus;
  }): Promise<ScrapeJob> {
    return this.prisma.scrapeJob.create({ data });
  }

  async findById(id: string): Promise<ScrapeJob | null> {
    return this.prisma.scrapeJob.findUnique({ where: { id } });
  }

  async updateStatus(
    id: string,
    data: {
      status: JobStatus;
      attempts?: Prisma.IntFieldUpdateOperationsInput;
      results?: Prisma.InputJsonValue;
      error?: string;
      completedAt?: Date;
    },
  ): Promise<ScrapeJob> {
    return this.prisma.scrapeJob.update({ where: { id }, data });
  }
}
