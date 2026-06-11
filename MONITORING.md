# How Monitoring Works in PriceCompare NG

This document explains the three-layer observability stack: structured logging (pino),
error tracking (Sentry / GlitchTip), and metrics (Prometheus + Grafana).

---

## 1. Structured Logging — pino

### The problem with `console.log`

```js
// Before — unstructured, hard to query in production
console.log(`[worker] Job ${jobDbId} completed — ${results.length} result(s)`);
console.error(`Failed to search Konga:`, error.message);
```

You can't filter these in a log aggregator. There's no machine-readable format.
Every line is a free-form string.

### After — pino emits JSON

```ts
// backend/src/config/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',             // human-readable in dev
      options: { colorize: true, ignore: 'pid,hostname' },
    },
  }),
});

export const createLogger = (bindings: Record<string, unknown>) =>
  logger.child(bindings);               // child loggers inherit bindings
```

In **development** you see:
```
[11:32:01] INFO (worker): Scrape job started
    jobId: "abc123"
    jobName: "keyword"
    jobDbId: 42
    queryType: "keyword"
    query: "iPhone 15"
```

In **production** (NODE_ENV=production) the same line is:
```json
{"level":30,"time":1718000000000,"jobId":"abc123","jobName":"keyword","jobDbId":42,"msg":"Scrape job started"}
```

The JSON format is what log aggregators (Datadog, BetterStack, CloudWatch) ingest and index.

### Child loggers — correlation IDs per job

Every BullMQ job gets its own child logger with `jobId` and `jobName` bound to it.
Every log line emitted inside that job automatically includes those fields — no need to pass them around.

```ts
// backend/src/worker.ts
const worker = new Worker<ScrapeQueueData>('scrape', async (job) => {

  // Create a child logger scoped to this specific job
  const jobLog = logger.child({ jobId: job.id, jobName: job.name });

  jobLog.info({ jobDbId, queryType, query }, 'Scrape job started');
  // → {"jobId":"abc123","jobName":"keyword","jobDbId":42,"query":"iPhone 15","msg":"Scrape job started"}

  // ... do work ...

  jobLog.info({ jobDbId, resultCount: results.length }, 'Scrape job complete');
  // → {"jobId":"abc123","jobName":"keyword","jobDbId":42,"resultCount":15,"msg":"Scrape job complete"}
});
```

If a job fails you can grep all logs for `"jobId":"abc123"` and see the full timeline.

---

## 2. Error Tracking — Sentry / GlitchTip

### What it is

Sentry (or its open-source clone GlitchTip) is a hosted service that receives error
reports from your app and shows them in a dashboard with:
- Full stack trace
- Which request/job triggered it
- How many times it has happened
- Email/Slack alerts

### Initialisation

Sentry must be initialised **before** any other imports so it can hook into Node's
uncaught exception handler. That's why the init call is at the very top of each
process entry point:

```ts
// backend/src/server.ts  (same pattern in worker.ts, notification-worker.ts)
import { initSentry, Sentry } from './config/sentry';
initSentry('backend');           // ← line 2, before all other imports

import express from 'express';
// ...
```

```ts
// backend/src/config/sentry.ts
import * as Sentry from '@sentry/node';

export function initSentry(serverName: string): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;              // no DSN = Sentry silently disabled
  Sentry.init({
    dsn,
    serverName,                  // identifies which process sent the error
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
}

export { Sentry };
```

### Where errors are captured

**1. Unhandled HTTP errors (Express middleware)**

```ts
// backend/src/server.ts
function createApp() {
  // ... routes ...

  Sentry.setupExpressErrorHandler(app);  // ← Sentry hooks in before your handler
  app.use(errorHandler);                 // ← your custom handler runs after
}
```

`setupExpressErrorHandler` automatically captures any error passed to `next(err)`
in Express. Your `errorHandler` then formats the HTTP response.

**2. Explicit capture for unexpected errors**

```ts
// backend/src/middleware/errorHandler.ts
} else {
  // Not a known error class — this is unexpected, capture it
  Sentry.captureException(err);
  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
}
```

**3. Failed BullMQ jobs**

```ts
// backend/src/worker.ts
worker.on('failed', async (job, err) => {
  // Every failed job is reported to Sentry with the job context attached
  Sentry.captureException(err, { tags: { jobName: job.name, jobId: job.id } });

  logger.error({ jobDbId, err: err.message }, 'Scrape job permanently failed');
});
```

**4. React frontend — error boundary**

```tsx
// frontend/src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={<p>Something went wrong. Please refresh.</p>}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
```

Any unhandled JS error in a React component tree is caught here and sent to Sentry.

### Sentry DSN

Sign up at sentry.io (free tier), create a Node.js project, and add the DSN to `backend/.env`:

```env
SENTRY_DSN=https://abc123@o456.ingest.sentry.io/789
```

Without a DSN, `initSentry()` is a no-op — the app runs normally, errors just aren't tracked remotely.

---

## 3. Prometheus Metrics

### What it is

Prometheus is a time-series database that **pulls** metrics from your app on an
interval (every 15s here). You expose a `/metrics` endpoint; Prometheus scrapes it.

### The endpoint

```ts
// backend/src/server.ts
import { registry } from './config/metrics';

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

Hit `http://localhost:3000/metrics` and you'll see plain text like:

```
# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/v1/jobs/:id",status="200",le="0.05"} 12
http_request_duration_seconds_bucket{method="GET",route="/api/v1/jobs/:id",status="200",le="0.1"} 45
...
http_request_duration_seconds_sum{method="GET",route="/api/v1/jobs/:id",status="200"} 3.241
http_request_duration_seconds_count{method="GET",route="/api/v1/jobs/:id",status="200"} 48

# HELP scrape_duration_seconds Scrape duration per platform
scrape_duration_seconds_bucket{platform="Jumia",status="success",le="0.5"} 0
scrape_duration_seconds_bucket{platform="Jumia",status="success",le="1"} 2
...
scrape_duration_seconds_bucket{platform="Konga",status="error",le="15"} 3
```

### Three custom metrics

```ts
// backend/src/config/metrics.ts
import { Registry, collectDefaultMetrics, Histogram } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });  // Node.js internals: memory, GC, event loop

// 1. HTTP request duration — per route, method, and status code
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

// 2. Scrape duration — per platform (Jumia/Konga/Jiji) and success/error
export const scrapeDuration = new Histogram({
  name: 'scrape_duration_seconds',
  help: 'Scrape duration per platform',
  labelNames: ['platform', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 15, 20],
  registers: [registry],
});

// 3. Job processing duration — per BullMQ job name
export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'BullMQ job processing duration',
  labelNames: ['job_name', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 15, 30, 60],
  registers: [registry],
});
```

### How each metric is recorded

**HTTP request duration** — Express middleware using `startTimer()`:

```ts
// backend/src/server.ts
app.use((req, res, next) => {
  // startTimer() returns a function; call it when the response finishes
  const end = httpRequestDuration.startTimer({ method: req.method });

  res.on('finish', () => {
    // req.route?.path gives the pattern ("/api/v1/jobs/:id"), not the URL
    // This keeps label cardinality low — no unique job IDs in metric names
    end({ route: req.route?.path ?? req.path, status: String(res.statusCode) });
  });

  next();
});
```

**Scrape duration** — wraps each per-platform scrape call:

```ts
// backend/src/services/ScraperService.ts
const searchPromises = scrapers.map(async (scraper) => {
  const endTimer = scrapeDuration.startTimer({ platform: scraper.platformName });
  try {
    const results = await this.withTimeout(
      scraper.searchProducts(normalizedKeyword, filters.limit ?? 10, scraperFilters),
      scraper.platformName,
    );
    endTimer({ status: 'success' });   // records duration with status=success
    return results;
  } catch (error) {
    endTimer({ status: 'error' });     // records duration with status=error
    return [];
  }
});
```

**Job duration** — wraps the BullMQ job handler:

```ts
// backend/src/worker.ts
const worker = new Worker('scrape', async (job) => {
  const endTimer = jobDuration.startTimer({ job_name: job.name });
  try {
    // ... process job ...
    endTimer({ status: 'success' });
  } catch (err) {
    endTimer({ status: 'error' });
    throw err;
  }
});
```

### How Prometheus scrapes it

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s          # pull /metrics every 15 seconds

scrape_configs:
  - job_name: pricecompare-backend
    static_configs:
      - targets: ['backend:3000'] # backend hostname on the Docker network
    metrics_path: /metrics
```

Prometheus stores each scrape as a timestamped sample. Over time this builds a
time series you can query.

### Grafana — visualising it

Grafana connects to Prometheus and lets you write PromQL queries to build dashboards.
The Prometheus datasource is auto-provisioned on first start
(`monitoring/grafana/provisioning/datasources/prometheus.yml`).

Useful queries to start with:

```promql
# p95 HTTP response time for search endpoints over the last hour
histogram_quantile(0.95,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket{route=~"/api/v1/search.*"}[5m])
  )
)

# Average scrape duration per platform
rate(scrape_duration_seconds_sum[5m]) / rate(scrape_duration_seconds_count[5m])

# Job failure rate (ratio of error to total)
rate(job_duration_seconds_count{status="error"}[5m])
  /
rate(job_duration_seconds_count[5m])

# Node.js heap usage
nodejs_heap_size_used_bytes
```

---

## How the three layers fit together

```
Something goes wrong
        │
        ├─ pino logs the error as structured JSON
        │   → visible in docker compose logs / log aggregator
        │   → searchable by jobId, platform, route
        │
        ├─ Sentry/GlitchTip captures the exception
        │   → you get an email/alert immediately
        │   → full stack trace + context in the dashboard
        │
        └─ Prometheus records the failure via status="error" label
            → Grafana shows the spike in the error rate chart
            → you can set a Grafana alert if failure rate > X%
```

---

## URLs (when docker compose is running)

| URL | What |
|---|---|
| `http://localhost:3000/metrics` | Raw Prometheus metrics text |
| `http://localhost:9090` | Prometheus — query raw time-series data |
| `http://localhost:3001` | Grafana — dashboards (admin / admin) |

---

*Delete this file when done — it's a temporary reference.*