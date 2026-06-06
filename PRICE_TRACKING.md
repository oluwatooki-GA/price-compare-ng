# Price Tracking & Alerts — Architecture & Flow

## Overview

The price tracking feature lets authenticated users follow specific products from search results. Every 3 days the system automatically re-scrapes those products, records price history, and sends email alerts when a price drops below a user-defined threshold.

---

## New Files

```
backend/
├── prisma/
│   └── migrations/
│       └── 20260605000000_add_tracked_products/
│           └── migration.sql               ← new DB tables
├── src/
│   ├── config/
│   │   └── env.ts                          ← GMAIL_USER, GMAIL_APP_PASSWORD added
│   ├── queue/
│   │   ├── index.ts                        ← scrapeQueue + notificationQueue singletons
│   │   └── types.ts                        ← PriceCheckJobData, AlertJobData, ScrapeQueueData added
│   ├── repositories/
│   │   ├── interfaces/
│   │   │   ├── ITrackedProductRepository.ts
│   │   │   └── ITrackedPriceHistoryRepository.ts
│   │   ├── TrackedProductRepository.ts
│   │   ├── TrackedPriceHistoryRepository.ts
│   │   └── RepositoryContainer.ts          ← two new repos wired in
│   ├── services/
│   │   ├── TrackedProductService.ts        ← CRUD + dashboard
│   │   ├── PriceCheckService.ts            ← scrape + record; returns AlertJobData | null
│   │   └── AlertEmailService.ts            ← Nodemailer/Gmail
│   ├── api/v1/
│   │   ├── tracked-products/
│   │   │   ├── schemas.ts
│   │   │   └── routes.ts
│   │   └── dashboard/
│   │       └── routes.ts
│   ├── workers/
│   │   ├── scheduler.ts                    ← new process, fires every 3 days
│   │   └── notification-worker.ts          ← new process, sends emails
│   └── worker.ts                           ← updated to handle price-check jobs + owns notification queue

frontend/
├── src/
│   ├── types/index.ts                      ← TrackedProduct, TrackedPriceHistoryEntry added
│   ├── api/
│   │   └── trackedProducts.ts              ← API client functions
│   ├── hooks/
│   │   └── useTrackedProducts.ts           ← React Query hook
│   ├── pages/
│   │   └── Dashboard.tsx                   ← /dashboard page
│   ├── components/
│   │   └── tracked/
│   │       └── TrackProductModal.tsx       ← modal on search results
│   ├── App.tsx                             ← /dashboard route added
│   └── components/layout/Header.tsx        ← Dashboard link added

docker-compose.yml                          ← scheduler + notification-worker services added
```

---

## Database Schema

### TrackedProduct

Belongs to a user. One row per user/URL pair (enforced by unique constraint).

```sql
CREATE TABLE "TrackedProduct" (
  "id"             SERIAL PRIMARY KEY,
  "userId"         INTEGER NOT NULL REFERENCES "User"("id"),
  "productUrl"     TEXT NOT NULL,        -- URL to re-scrape
  "productName"    TEXT NOT NULL,
  "platform"       TEXT NOT NULL,        -- 'jumia' | 'jiji' | 'konga'
  "imageUrl"       TEXT,
  "lastKnownPrice" DOUBLE PRECISION,     -- updated on every price-check
  "alertThreshold" DOUBLE PRECISION,     -- user-defined price to alert at
  "alertEnabled"   BOOLEAN DEFAULT false,
  "isActive"       BOOLEAN DEFAULT true,
  "createdAt"      TIMESTAMP DEFAULT NOW(),
  "updatedAt"      TIMESTAMP,
  "lastCheckedAt"  TIMESTAMP,
  UNIQUE ("userId", "productUrl")
);
```

### TrackedPriceHistory

A time-series of price snapshots. Each price-check appends a new row. Cascade-deletes when the parent `TrackedProduct` is deleted.

```sql
CREATE TABLE "TrackedPriceHistory" (
  "id"               SERIAL PRIMARY KEY,
  "trackedProductId" INTEGER NOT NULL REFERENCES "TrackedProduct"("id") ON DELETE CASCADE,
  "price"            DOUBLE PRECISION NOT NULL,
  "currency"         TEXT DEFAULT 'NGN',
  "availability"     BOOLEAN DEFAULT true,
  "recordedAt"       TIMESTAMP DEFAULT NOW()
);
```

> The existing `PriceHistory` model (one row per URL/platform, unique constraint) is unrelated and unchanged. `TrackedPriceHistory` is a separate time-series specifically for user-tracked products.

---

## Queues

Two BullMQ queues share the same Redis instance, different key namespaces.

| Queue          | Producer   | Consumer                 | Job types                 |
|----------------|------------|--------------------------|---------------------------|
| `scrape`       | API routes, scheduler | `worker.ts`   | keyword, url, price-check |
| `notification` | `worker.ts` | `notification-worker.ts` | price-alert               |

### Ownership rules

Both queues are singletons exported from `queue/index.ts` — the single source of truth, matching the same pattern.

- **`scrapeQueue`** — imported by API routes and the scheduler to publish jobs.
- **`notificationQueue`** — imported by `worker.ts` to publish alert jobs after a price-check.
- **`notification-worker.ts`** creates only a `Worker('notification', ...)` — it is a consumer only and never imports a `Queue` instance.

### Job types

```typescript
// queue/types.ts

// Existing — jobType absent or 'scrape'
interface ScrapeJobData {
  jobType?: 'scrape';
  jobDbId: string;
  query: string;
  queryType: 'keyword' | 'url';
  filters: { ... };
}

// New — published by the scheduler
interface PriceCheckJobData {
  jobType: 'price-check';
  trackedProductId: number;
  productUrl: string;
  platform: string;
  userId: number;
}

// Union type used to parameterise scrapeQueue and the scrape Worker
type ScrapeQueueData = ScrapeJobData | PriceCheckJobData;

// Published by worker.ts to the notification queue
interface AlertJobData {
  trackedProductId: number;
  userEmail: string;
  productName: string;
  productUrl: string;
  platform: string;
  newPrice: number;
  threshold: number;
  currency: string;
}
```

---

## Process Map

Four running processes total (up from two):

```
┌─────────────┐     ┌──────────────────────────────┐     ┌────────────────────┐
│  backend    │     │  worker                      │     │  scheduler         │
│  (API)      │     │                              │     │                    │
│  POST       │     │  listens on 'scrape' queue   │     │  fires every 3d    │
│  /tracked-  │     │                              │     │  imports scrapeQueue│
│  products   │     │  ┌──────────┐ ┌───────────┐  │     │  singleton         │
│             │     │  │scrape job│ │price-check│  │     │  adds price-check  │
│  GET        │     │  └──────────┘ └─────┬─────┘  │     │  jobs in batches   │
│  /dashboard │     │                     │        │     └────────────────────┘
└─────────────┘     │  PriceCheckService  │        │
                    │  .checkPrice()      │        │     ┌────────────────────┐
                    │  returns            │        │     │notification-worker │
                    │  AlertJobData|null  │        │     │                    │
                    │                     ▼        │     │  Worker only —     │
                    │  worker.ts calls            │     │  no Queue instance │
                    │  notificationQueue.add()    │──── │                    │
                    │  (owns the queue)           │     │  AlertEmailService  │
                    │                             │     │  → Nodemailer/Gmail │
                    └─────────────────────────────┘     └────────────────────┘
```

---

## Full Request Flows

### 1. User tracks a product

```
User clicks "Track" on a product card in search results
    → TrackProductModal opens (optional: set alert threshold)
    → POST /api/v1/tracked-products
        body: { productUrl, productName, platform, imageUrl,
                currentPrice, alertThreshold, alertEnabled }

    → TrackedProductService.trackProduct()
        1. Check TrackedProduct table for existing row (same userId + productUrl)
           - if exists and inactive → reactivate it
           - if exists and active   → throw "already tracking"
        2. INSERT TrackedProduct row
        3. If currentPrice provided → INSERT TrackedPriceHistory row (seed point)

    → Returns TrackedProduct with priceHistory[]
    → React Query invalidates ['dashboard'] key
```

### 2. Scheduler fires (every 3 days)

```
BullMQ repeating job fires on 'scheduler' queue
    → Scheduler worker processes 'tick' job
    → Imports the existing scrapeQueue singleton from queue/index.ts
    → SELECT all active TrackedProducts (paginated, 100 at a time)
    → For each batch:
        scrapeQueue.addBulk([
          { jobType: 'price-check', trackedProductId: 1, ... },
          { jobType: 'price-check', trackedProductId: 2, ... },
          ...100 jobs
        ])
    → sleep 5 seconds
    → next batch
    → repeat until all active products have a job queued
```

### 3. Price-check job runs (in the scrape worker)

```
worker.ts receives job from 'scrape' queue
    job.data.jobType === 'price-check'
    → alertData = await priceCheckService.checkPrice(trackedProductId)

        PriceCheckService.checkPrice() — pure service, no queue knowledge:
        1. Load TrackedProduct from DB
           - if not found or isActive=false → return null

        2. Get scraper for platform
           scraperRegistry.getScraperByPlatform('jumia')  ← reuses existing scraper
           - if no scraper found → log warning, return null

        3. scraper.getProductByUrl(productUrl)
           - if scrape fails → log error, update lastCheckedAt, return null

        4. INSERT TrackedPriceHistory { price, currency, availability, recordedAt: now }

        5. UPDATE TrackedProduct {
             lastKnownPrice: newPrice,
             lastCheckedAt: now,
             productName: product.name,
             imageUrl: product.imageUrl,
           }

        6. Alert check:
           if alertEnabled && alertThreshold !== null && newPrice <= alertThreshold:
               load User to get email
               return AlertJobData   ← service returns data, does not touch queue

    back in worker.ts:
    → if (alertData) notificationQueue.add('price-alert', alertData)
       ← worker decides to publish, owns the queue
```

### 4. Email alert fires

```
notification-worker receives job from 'notification' queue
    → AlertEmailService.sendPriceAlert(job.data)
        - if transporter is null (no Gmail creds) → log warning, return
        - otherwise: nodemailer.sendMail({ to: userEmail, html: ... })

    Retries 3× with exponential backoff (2s → 4s → 8s) on failure
```

---

## Services

### TrackedProductService

Pure CRUD + business rules. Has no knowledge of scraping, queues, or emails.

```typescript
trackProduct(userId, data)             // create, or reactivate if soft-deleted
getUserTrackedProducts(userId)         // list with priceHistory[] joined
getPriceHistory(userId, id)            // verify ownership, return history
updateAlertSettings(userId, id, data)  // patch threshold/enabled, verify ownership
deleteTrackedProduct(userId, id)       // verify ownership, hard-delete
getDashboardSummary(userId)            // alias for getUserTrackedProducts
```

### PriceCheckService

Called by the worker. No queue dependency — returns `AlertJobData | null` and lets the worker decide what to do with it.

```typescript
constructor(
  scraperRegistry,           // reuses existing scrapers
  trackedProductRepository,
  trackedPriceHistoryRepository,
  userRepository,            // needed to look up email for the returned AlertJobData
)

checkPrice(trackedProductId): Promise<AlertJobData | null>
// returns AlertJobData if an alert should be sent, null otherwise
// never touches a queue
```

### AlertEmailService

Thin wrapper around Nodemailer. Gracefully no-ops if Gmail credentials are absent.

```typescript
constructor()           // sets up transporter from env, or warns and sets null
sendPriceAlert(data)    // builds HTML email, calls transporter.sendMail()
```

---

## Queue Lifecycle Summary

| Instance | Created by | Notes |
|---|---|---|
| `scrapeQueue` (singleton) | `queue/index.ts` module load | Imported by API routes + scheduler |
| `notificationQueue` (singleton) | `queue/index.ts` module load | Imported by `worker.ts` to publish alerts |
| scheduler queue | `startScheduler()` | Only used by scheduler process |
| `Worker('scrape')` | `startWorker()` | — |
| `Worker('scheduler')` | `startScheduler()` | — |
| `Worker('notification')` | `startNotificationWorker()` | Consumer only, no Queue instance |

---

## API Endpoints

All endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tracked-products` | Start tracking a product |
| `GET` | `/api/v1/tracked-products` | List user's tracked products (with history) |
| `PATCH` | `/api/v1/tracked-products/:id` | Update `alertThreshold` / `alertEnabled` |
| `DELETE` | `/api/v1/tracked-products/:id` | Stop tracking (deletes row + cascades history) |
| `GET` | `/api/v1/tracked-products/:id/price-history` | Price history array for one product |
| `GET` | `/api/v1/dashboard` | All tracked products with history (same as list, wrapped) |

---

## Environment Variables

Add these to `backend/.env` to enable email alerts:

```bash
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # 16-char App Password from Google
```

Both are optional. If absent, `AlertEmailService` logs a warning at startup and skips sending — the rest of the feature (tracking, history, dashboard) works normally.

**Getting a Gmail App Password:**
1. Google Account → Security → enable 2-Step Verification
2. Security → App Passwords → generate one (name it anything)
3. Copy the 16-character password into `.env`

---

## Docker Services

```yaml
# Existing
worker:
  command: sh -c "sleep 8 && npm run worker"

# New — schedules price-check jobs every 3 days
scheduler:
  command: sh -c "sleep 10 && npm run scheduler"

# New — sends alert emails
notification-worker:
  command: sh -c "sleep 8 && npm run notification-worker"
```

All three share the same `backend` Docker image and `.env` file.

---

## Frontend

### Dashboard page (`/dashboard`)

- Protected route — requires login
- Fetches `GET /api/v1/dashboard` via `useTrackedProducts` hook
- One card per tracked product:
  - Product image / name / platform
  - Current price (from `lastKnownPrice`)
  - Last checked timestamp (relative: "3h ago", "2d ago")
  - Recharts `LineChart` of price history (shows after ≥2 data points)
  - Alert toggle (on/off) with inline threshold editor
  - Delete button (trash icon)

### Track button on search results

- Appears on every product card alongside the existing Save button
- Requires login (shows toast if anonymous)
- Opens `TrackProductModal`:
  - Shows product name + current price
  - Optional: toggle alert on, set threshold (defaults to 90% of current price)
  - On confirm → `POST /api/v1/tracked-products`

### React Query cache keys

| Key | Fetches |
|-----|---------|
| `['dashboard']` | `GET /api/v1/dashboard` — stale after 2 min |
| `['comparisons']` | unchanged |
| `['user']` | unchanged |

---

## What Was Not Changed

- All existing scraper logic (`jumia.ts`, `jiji.ts`, `konga.ts`, `ScraperService.ts`)
- The `scrape` queue job format for keyword/URL searches
- All existing API routes and middleware
- The `PriceHistory` model (global price cache, unrelated to per-user tracking)
- All 119 existing tests — they continue to pass
