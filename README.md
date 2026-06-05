# 🛒 PriceCompare NG

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-19-cyan)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

**Compare prices across Jumia, Konga & Jiji in seconds**

[Live Demo](https://price-compare-ng-frontend.onrender.com) • [API](https://price-compare-ng-backend.onrender.com/api-docs)

</div>

---

## 🎯 The Problem

Nigerian e-commerce shoppers waste time switching between tabs to compare prices across platforms. Often, they miss better deals or buy from overpriced sellers.

**PriceCompare NG solves this** by aggregating product data from multiple Nigerian e-commerce platforms into one unified interface.

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **🔗 URL Search** | Paste any Jumia/Jiji link → instantly find similar products with price comparisons |
| **🔍 Keyword Search** | Search across all platforms with price range and rating filters |
| **⚙️ Async Job Queue** | Searches run as background jobs (BullMQ); the API returns a `jobId` instantly and the UI polls until results are ready |
| **💾 Save Comparisons** | Keep track of products you're interested in (up to 50 saved items) |
| **⭐ Best Value Badge** | Automatically highlights the cheapest available deal |
| **📱 Mobile Responsive** | Fully optimized for mobile with animated hamburger menu |
| **🔒 Secure Auth** | JWT-based authentication with bcrypt password hashing |
| **🔄 Redis** | Shared Redis powers the job queue, the 5-minute result cache, and rate limiting |
| **📊 Queue Dashboard** | Bull Board UI at `/admin/queues` for live job monitoring |

## 🏗️ Architecture

Searches are **asynchronous**. The API process never scrapes — it enqueues a job
and returns a `jobId`. A separate **worker** process consumes jobs from the
BullMQ queue, runs the scrapers, and writes results back to PostgreSQL. The
frontend polls `GET /api/v1/jobs/:jobId` until the job is `COMPLETED` or `FAILED`.

```mermaid
flowchart TB
    subgraph Frontend
        UI["React UI"]
        Hooks["useSearch (polls every 2s)"]
    end

    subgraph API["API Process"]
        Routes["Express Routes"]
        Submit["SearchSubmitService"]
        JobsRoute["Jobs Route"]
    end

    subgraph WorkerProc["Worker Process"]
        Worker["BullMQ Worker"]
        Scraper["ScraperService"]
        S1["Jumia"]
        S2["Konga"]
        S3["Jiji"]
    end

    subgraph Data
        Redis[("Redis<br/>queue · cache · rate limit")]
        DB[("PostgreSQL<br/>jobs · users · comparisons")]
    end

    UI --> Hooks -->|"POST /search/keyword"| Routes
    Routes --> Submit -->|"enqueue"| Redis
    Submit -->|"create ScrapeJob (PENDING)"| DB
    Hooks -->|"poll GET /jobs/:id"| JobsRoute --> DB
    Redis -->|"job"| Worker --> Scraper --> S1 & S2 & S3
    Worker -->|"save results (COMPLETED)"| DB
```

### Async search flow

1. `POST /api/v1/search/keyword` → `SearchSubmitService` checks for a recent
   completed job (cache hit → `200` with results) or an in-flight duplicate
   (dedup → returns its `jobId`), otherwise creates a `ScrapeJob` and enqueues
   it → `202 { jobId, status: "PENDING" }`.
2. The **worker** picks up the job, runs `ScraperService` across all platforms,
   normalizes results, and updates the job to `COMPLETED` (or `FAILED`).
3. The frontend polls `GET /api/v1/jobs/:jobId` every 2s until it settles.

### Design Patterns

- **Job Queue / Worker** - Scraping runs out-of-process via BullMQ; the API stays fast and the worker scales independently
- **Adapter Pattern** - Platform scrapers extend a base `ScraperAdapter` class for easy extensibility
- **Service Layer** - Business logic in `services/` (`SearchSubmitService`, `ScraperService`, `AuthService`, …), separate from HTTP routes
- **Repository Pattern** - Data access isolated in `repositories/` (Prisma); routes and services never query Prisma directly
- **Shared Redis Client** - A single `config/redis.ts` connection backs the queue, cache, and rate limiter
- **Rate Limiting** - Redis-backed, IP-based for anonymous and user-based for authenticated requests

### Tech Stack

**Backend:** Express.js, TypeScript, BullMQ, Prisma ORM, PostgreSQL, Redis, JWT, Cheerio

**Frontend:** React 19, Vite, TailwindCSS, Framer Motion, TanStack Query, React Router

**Infrastructure:** Docker, Docker Compose

**Load testing:** k6

## 🚀 Quick Start with Docker

The easiest way to run this project is using Docker Compose:

```bash
# Clone the repo
git clone https://github.com/oluwatooki-GA/price-compare-ng.git
cd price-compare-ng

# Start all services (postgres, redis, backend, frontend)
docker compose up --build

# Access the application
# Frontend:    http://localhost:5173
# Backend API: http://localhost:3000
# API Docs:    http://localhost:3000/api-docs
# Queue Board: http://localhost:3000/admin/queues
```

That's it! Docker handles all dependencies including PostgreSQL and Redis.

> In development the backend builds from `Dockerfile.dev`, which runs
> `prisma db push` to sync the schema on every start. The production `Dockerfile`
> runs `prisma migrate deploy` against the committed migrations instead.

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React app with Vite HMR |
| Backend | 3000 | Express API (enqueues jobs, serves results) |
| Worker | — | BullMQ worker process that runs the scrapers |
| PostgreSQL | 5432 | Database (jobs, users, saved comparisons) |
| Redis | 6379 | Job queue, result cache & rate limiting |

Scale the worker to process more jobs in parallel:

```bash
docker compose up -d --scale worker=3
```

## 📸 Screenshots

<div align="center">
  <img src="screenshots/home.png" alt="Home Page" width="400"/>
  <img src="screenshots/home form.png" alt="URL Input Form" width="400"/>
</div>

<div align="center">
  <img src="screenshots/search results.png" alt="Search Results" width="400"/>
  <img src="screenshots/saved comparisons general.png" alt="Saved Comparisons" width="400"/>
</div>

<div align="center">
  <img src="screenshots/login.png" alt="Login" width="300"/>
  <img src="screenshots/register.png" alt="Register" width="300"/>
</div>

## 📂 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── api/v1/        # HTTP routes only (auth, search, comparisons, jobs)
│   │   ├── services/      # Business logic (SearchSubmit, Scraper, Auth, …)
│   │   ├── repositories/  # Data access (Prisma) — incl. ScrapeJobRepository
│   │   ├── scrapers/      # Platform adapters (Jumia, Konga, Jiji)
│   │   ├── queue/         # BullMQ queue definition + job types
│   │   ├── middleware/    # auth, rate limiting, error handling
│   │   ├── config/        # env, database, shared redis client, security
│   │   ├── server.ts      # Express API entry point
│   │   └── worker.ts      # Standalone BullMQ worker process
│   ├── __tests__/        # unit / integration / e2e (Vitest)
│   ├── prisma/           # Schema and migrations
│   ├── Dockerfile        # Production image (migrate deploy)
│   ├── Dockerfile.dev    # Dev image (db push + hot reload)
│   └── .env.sample       # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level pages
│   │   ├── hooks/        # Custom React hooks (useSearch polls jobs)
│   │   └── api/          # API client functions
│   └── Dockerfile        # Container definition
├── tests/load/           # k6 load tests (search.js, worker-stress.js)
├── docker-compose.yml    # Service orchestration
└── .env.sample          # Root environment template
```

## 🔧 Environment Variables

Copy `.env.sample` to `.env` in each directory:

**Backend (`backend/.env`):**
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://pricecompare:pricecompare123@postgres:5432/pricecompare
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
REDIS_URL=redis://redis:6379
CORS_ORIGINS=http://localhost:5173
# Load testing only — bypasses rate limiting. NEVER true in production.
DISABLE_RATE_LIMIT=false
```

**Frontend (`frontend/.env`):**
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## 🧪 Testing

```bash
# Backend tests (Vitest — unit + integration)
docker compose exec backend npm test

# Frontend linting
docker compose exec frontend npm run lint
```

### Load testing (k6)

Two k6 scenarios live in `tests/load/` — see [`tests/load/README.md`](tests/load/README.md)
for full instructions:

- **`search.js`** — 50 users hitting shared queries; stresses the **API** and
  exercises the cache/dedup path.
- **`worker-stress.js`** — 50 users with unique, uncached queries so every
  request creates a real job; stresses the **worker pool** (threshold: 95% of
  jobs complete within 60s).

```bash
# from the repo root, with the stack running
k6 run tests/load/search.js
k6 run tests/load/worker-stress.js
```

> Set `DISABLE_RATE_LIMIT=true` in `backend/.env` before load testing, otherwise
> 50 users from one IP trip the rate limiter.

## 🔮 Future Enhancements

- [ ] Price history tracking and alerts
- [ ] Email notifications for price drops
- [ ] Chrome extension for one-click price comparisons
- [ ] Support for more Nigerian e-commerce platforms
- [ ] Product review aggregation

## 💡 What I Learned

Building this project taught me:

- **Async Architecture** - Decoupling slow scraping from the request cycle with a BullMQ job queue and a standalone worker process
- **Clean Architecture** - Separating HTTP routes, service-layer business logic, and repository data access
- **Web Scraping Challenges** - Handling dynamic content, rate limits, and HTML parsing
- **Database Design** - Designing schemas for many-to-many relationships
- **Type Safety** - Leveraging TypeScript across the full stack
- **State Management** - Using TanStack Query for server state vs React state
- **Authentication Flow** - Implementing secure JWT auth with proper token management
- **Docker Deployment** - Containerizing full-stack applications with orchestration
- **Caching Strategies** - Implementing Redis for performance optimization
- **Load Testing** - Profiling API vs worker bottlenecks with k6

## 📄 License

MIT License - feel free to use this project for learning or inspiration.

---

<div align="center">
Built with ❤️ for Nigerian shoppers
</div>
