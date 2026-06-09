import { Registry, collectDefaultMetrics, Histogram } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const scrapeDuration = new Histogram({
  name: 'scrape_duration_seconds',
  help: 'Scrape duration per platform',
  labelNames: ['platform', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 15, 20],
  registers: [registry],
});

export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'BullMQ job processing duration',
  labelNames: ['job_name', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 15, 30, 60],
  registers: [registry],
});
