# PriceCompare NG

Compare prices across Jumia, Konga, and Jiji from a single interface.

[Live Demo](https://price-compare-ng-frontend.onrender.com) | [API Docs](https://price-compare-ng-backend.onrender.com/api-docs)

---

## Features

- **Keyword and URL search** — search by term or paste a product URL to find it across all platforms
- **Async job queue** — searches run in a background worker; the API returns a `jobId` immediately and the UI polls until complete
- **Price tracking** — track specific products; prices are re-checked every 3 days automatically
- **Price alerts** — set a threshold; receive an email when a product drops below it
- **Save comparisons** — bookmark up to 50 products per account
- **Best value badge** — highlights the cheapest available option
- **Redis caching** — 5-minute result cache and deduplication prevent redundant scrapes
- **Queue dashboard** — Bull Board at `/admin/queues` for live job monitoring

---

## System Design

### Processes

The application runs as four separate processes:

| Process | Role |
|---|---|
| `backend` | Express API — handles HTTP requests, enqueues jobs, serves results |
| `worker` | BullMQ consumer — runs scrapers and price-checks, publishes alert jobs |
| `scheduler` | Fires every 3 days — enqueues price-check jobs for all active tracked products |
| `notification-worker` | BullMQ consumer — sends alert emails via Nodemailer/Gmail |

The API process never scrapes directly. Scraping and price-checking are always handled out-of-process by the worker.

### Queues

Two BullMQ queues backed by the shared Redis instance:

| Queue | Producer | Consumer | Job names |
|---|---|---|---|
| `scrape` | API routes (search), scheduler | `worker` | `keyword`, `url`, `price-check` |
| `notification` | `worker` | `notification-worker` | `price-alert` |

Both queue singletons are exported from `backend/src/queue/index.ts`. The worker dispatches on `job.name` — no `jobType` field in the payload.

### Async search flow

```
POST /search/keyword
  → SearchSubmitService checks for a recent completed job (cache hit → 200 with results)
  → or an in-flight duplicate (dedup → returns existing jobId)
  → otherwise: INSERT ScrapeJob (PENDING), enqueue 'keyword' job → 202 { jobId }

Worker picks up job
  → ScraperService scrapes all platforms in parallel
  → UPDATE ScrapeJob (COMPLETED, results)

Frontend polls GET /jobs/:jobId every 2s until settled
```

### Price tracking flow

```
POST /tracked-products
  → TrackedProductService creates TrackedProduct row
  → seeds first TrackedPriceHistory entry if current price provided

Scheduler fires every 3 days
  → reads all active TrackedProducts in batches of 100
  → enqueues 'price-check' jobs on the scrape queue

Worker receives 'price-check' job
  → PriceCheckService re-scrapes the product URL
  → appends a TrackedPriceHistory row
  → updates lastKnownPrice, lastCheckedAt
  → if alertEnabled && newPrice <= alertThreshold:
      returns AlertJobData to the worker
  → worker publishes to notification queue

notification-worker receives job
  → AlertEmailService sends HTML email via Gmail SMTP
  → retries 3x with exponential backoff on failure
```

### Key patterns

- **Repository pattern** — all Prisma access is isolated in `repositories/`; routes and services never query directly
- **Service layer** — business logic in `services/`; services have no knowledge of HTTP or queues
- **Adapter pattern** — scrapers extend a base `ScraperAdapter`; adding a new platform means one new file
- **Singleton queues** — queue instances are created once at module load and imported wherever needed; workers own no queues except those they produce to
- **Shared Redis** — one `config/redis.ts` connection backs the job queue, result cache, and rate limiter

### Tech stack

**Backend:** Express, TypeScript, BullMQ, Prisma, PostgreSQL, Redis, Cheerio

**Frontend:** React 19, Vite, TailwindCSS, Framer Motion, TanStack Query

**Infrastructure:** Docker, Docker Compose, k6

---

## Quick Start

```bash
git clone https://github.com/oluwatooki-GA/price-compare-ng.git
cd price-compare-ng
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost:5173 | Frontend |
| http://localhost:3000 | Backend API |
| http://localhost:3000/api-docs | Swagger docs |
| http://localhost:3000/admin/queues | Bull Board |

Scale the worker to process more jobs concurrently:

```bash
docker compose up -d --scale worker=3
```

---

## Docker Services

| Service | Description |
|---|---|
| `frontend` | React app (Vite HMR on port 5173) |
| `backend` | Express API (port 3000) |
| `worker` | Scrape + price-check worker |
| `scheduler` | Enqueues price-check jobs every 3 days |
| `notification-worker` | Sends price alert emails |
| `postgres` | PostgreSQL 17 (port 5432) |
| `redis` | Redis (port 6379) |

In development the backend runs `prisma db push` on startup. The production Dockerfile runs `prisma migrate deploy` against committed migrations.

---

## Environment Variables

**`backend/.env`:**

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://pricecompare:pricecompare123@postgres:5432/pricecompare
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
REDIS_URL=redis://redis:6379
CORS_ORIGINS=http://localhost:5173

# Optional — enables price alert emails
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Load testing only — bypasses rate limiting
DISABLE_RATE_LIMIT=false
```

**`frontend/.env`:**

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

To get a Gmail App Password: Google Account > Security > 2-Step Verification > App Passwords.

---

## Project Structure

```
backend/src/
  api/v1/          HTTP routes (auth, search, jobs, tracked-products, dashboard)
  services/        Business logic (SearchSubmit, Scraper, Auth, TrackedProduct, PriceCheck, AlertEmail)
  repositories/    Prisma data access
  scrapers/        Platform adapters (Jumia, Konga, Jiji)
  queue/           BullMQ queue singletons and job type definitions
  workers/         scheduler.ts, notification-worker.ts
  middleware/      auth, rate limiting, error handling
  config/          env, database, redis, security
  server.ts        API entry point
  worker.ts        Scrape + price-check worker entry point

frontend/src/
  pages/           Dashboard, SearchResults, Home, Login, Register, SavedComparisons
  components/      Layout, tracked product modal, UI primitives
  hooks/           useSearch (polls jobs), useTrackedProducts, useSavedComparisons
  api/             API client functions

tests/load/        k6 load tests (search.js, worker-stress.js)
prisma/            Schema and migrations
```

---

## Testing

```bash
# Unit + integration tests (Vitest)
docker compose exec backend npm test

# Load tests (requires stack running)
# Set DISABLE_RATE_LIMIT=true before running
k6 run tests/load/search.js
k6 run tests/load/worker-stress.js
```

`search.js` — 50 users hitting shared queries; exercises the cache and dedup path.

`worker-stress.js` — 50 users with unique uncached queries; every request creates a real job and stresses the worker pool.

---

## License

MIT
