# Architecture Overview — price-compare-ng

---

## Folder Structure

### Backend (`backend/src/`)

```
backend/src/
├── server.ts                        # Express app bootstrap, middleware wiring, graceful shutdown
├── config/
│   ├── env.ts                       # Parses and validates all environment variables at startup
│   ├── database.ts                  # Prisma client singleton
│   ├── security.ts                  # JWT sign/verify helpers and bcrypt wrappers
│   └── swagger.ts                   # Swagger/OpenAPI definition setup
├── shared/
│   └── errors.ts                    # Custom error hierarchy (ValidationError, ScrapingError, etc.)
├── middleware/
│   ├── errorHandler.ts              # Global Express error handler — maps custom errors to HTTP codes
│   └── rateLimiter.ts               # Redis-backed express-rate-limit factory (10 req/min unauth, 60 auth)
├── repositories/
│   ├── base/Repository.ts           # Generic CRUD base class wrapping Prisma
│   ├── base/TransactionManager.ts   # Prisma transaction helper
│   ├── interfaces/                  # Repository interfaces (IUserRepository, etc.)
│   ├── UserRepository.ts            # Prisma queries for the User model
│   ├── PriceHistoryRepository.ts    # Prisma queries for the PriceHistory model
│   ├── SavedComparisonRepository.ts # Prisma queries for the SavedComparison model
│   └── RepositoryContainer.ts       # DI container that wires all repositories together
├── api/v1/
│   ├── auth/
│   │   ├── routes.ts                # POST /auth/register, POST /auth/login
│   │   ├── service.ts               # Register (bcrypt hash) and login (JWT issue) logic
│   │   └── schemas.ts               # Zod schemas for auth request bodies
│   ├── search/
│   │   ├── routes.ts                # POST /search/keyword, POST /search/url
│   │   ├── service.ts               # Orchestrates scrapers, Redis cache, normalization
│   │   ├── normalization.ts         # Outlier removal, product grouping, best-value scoring
│   │   └── schemas.ts               # Zod schemas for search request bodies
│   └── comparisons/
│       ├── routes.ts                # CRUD routes for saved comparisons + price history
│       ├── service.ts               # Save/retrieve/delete comparison logic
│       ├── priceHistory.ts          # PriceHistory recording (currently not integrated into search flow)
│       └── schemas.ts               # Zod schemas for comparison request bodies
└── scrapers/
    ├── base.ts                      # Abstract ScraperAdapter class and shared types (ProductData, SearchFilters)
    ├── registry.ts                  # ScraperRegistry singleton — registers and retrieves scrapers by name
    ├── utils.ts                     # fetchWithRetry, RateLimiter (per-platform), createHttpClient
    ├── jumia.ts                     # Jumia.com.ng scraper (Cheerio, CSS selectors)
    ├── jiji.ts                      # Jiji.ng scraper
    ├── konga.ts                     # Konga.com scraper
    └── temu.ts                      # Temu.com scraper (disabled / not registered)
```

### Frontend (`frontend/src/`)

```
frontend/src/
├── main.tsx                         # React entry point, mounts App
├── App.tsx                          # Router setup and top-level route definitions
├── api/
│   ├── client.ts                    # Axios instance with JWT Authorization header interceptor
│   ├── auth.ts                      # login() and register() API calls
│   ├── search.ts                    # searchByKeyword() and searchByUrl() API calls
│   └── comparisons.ts               # save/fetch/delete saved comparison API calls
├── hooks/
│   ├── useAuth.ts                   # Auth state (user, token) + login/logout mutations
│   ├── useSearch.ts                 # TanStack Query mutations wrapping the search API
│   └── useComparisons.ts            # TanStack Query queries/mutations for saved comparisons
├── pages/
│   ├── Home.tsx                     # Landing page with search entry
│   ├── SearchResults.tsx            # Displays comparison results, filters, save button
│   ├── Login.tsx                    # Login form
│   ├── Register.tsx                 # Registration form
│   └── SavedComparisons.tsx         # Lists user's saved comparisons
├── components/
│   ├── common/                      # Button, Input, LoadingSpinner, ErrorMessage — reusable primitives
│   ├── layout/                      # Header, Footer, Layout wrapper
│   ├── search/                      # SearchBar, SearchTypeToggle, SearchFilters, UnifiedSearch, UrlPrefillForm
│   ├── comparison/                  # ProductCard, ComparisonCard, BestValueBadge, PriceChart
│   ├── ui/                          # ShadCN-style low-level button/card primitives
│   └── ProtectedRoute.tsx           # Route guard that redirects unauthenticated users to /login
├── types/index.ts                   # Shared TypeScript interfaces (ProductData, ComparisonResult, User, etc.)
└── utils/formatting.ts              # Currency formatting, date helpers
```

---

## Request Flow: API Route → Scraper → Response

### Keyword search (`POST /api/v1/search/keyword`)

```
Client
  │
  ▼
routes.ts            Validate body with Zod (keyword, optional filters)
  │                  Apply optional auth (authenticateToken middleware)
  ▼
SearchService
  .searchByKeyword() Check Redis cache → return early on hit
  │                  Get all registered scrapers (filter by platform if supplied)
  │                  Run Promise.all across scrapers:
  │                    ┌──────────────────────────────────────┐
  │                    │  JumiaScraper.searchProducts()       │
  │                    │    RateLimiter.waitIfNeeded()        │
  │                    │    fetchWithRetry(searchUrl)         │
  │                    │      → axios GET with 10s timeout    │
  │                    │      → retry up to 3× on 5xx/429    │
  │                    │    cheerio.load(html)                │
  │                    │    Parse article.prd elements        │
  │                    │    Return ProductData[]              │
  │                    ├──────────────────────────────────────┤
  │                    │  KongaScraper.searchProducts() …     │
  │                    ├──────────────────────────────────────┤
  │                    │  JijiScraper.searchProducts() …      │
  │                    └──────────────────────────────────────┘
  │                  Flatten all results, apply availableOnly filter
  ▼
NormalizationService
  .groupSimilarProducts()
  │                  removeOutliers(): drop products whose price is
  │                    < 10% of median, > 10× median, or > 2σ from mean
  │                  Return each surviving product as its own ComparisonResult
  ▼
SearchService        Apply sortBy, apply limit, set searchQuery on each result
                     Write results to Redis (5-min TTL)
  │
  ▼
routes.ts            200 JSON response → { results: ComparisonResult[] }
```

### URL search (`POST /api/v1/search/url`)

Same path but the primary scraper calls `getProductByUrl(url)` instead, then the
name of that product is used as the keyword to search other platforms for similar
listings, and all products are grouped into a single `ComparisonResult`.

---

## Technologies

| Layer | Technology | Purpose |
|---|---|---|
| Backend runtime | Node.js + TypeScript | Server and type safety |
| HTTP framework | Express.js | Routing, middleware |
| ORM | Prisma | Database access (SQLite dev / PostgreSQL prod) |
| HTML parsing | Cheerio | Scraping product listings |
| HTTP client | Axios | Fetching scraper target pages |
| Cache / rate-limit store | Redis | 5-min result cache + per-user rate limiting |
| Auth | JWT + bcrypt | Stateless auth, password hashing |
| Validation | Zod | Request body schemas |
| API docs | Swagger/OpenAPI | `/api-docs` endpoint |
| Testing | Vitest + fast-check | Unit and property-based tests |
| Frontend framework | React 19 | UI |
| Build tool | Vite | Frontend bundler |
| Routing | React Router v7 | Client-side navigation |
| Server state | TanStack Query | Data fetching, caching, mutations |
| Styling | Tailwind CSS | Utility-first CSS |
| Animation | Framer Motion | UI transitions |
| Charts | Recharts | Price history visualization |
| Forms | React Hook Form + Zod | Validated form handling |

---

## Problems and Bottlenecks

### 1. Product grouping is intentionally disabled — flat list is by design
Each product is its own `ComparisonResult`. Best value (cheapest available product) is
determined client-side in `SearchResults.tsx` and pinned to position 0 with a green
badge. The backend `bestValueIndex` field is not used by the frontend.

### 2. `PriceHistory` is dead code
`PriceHistoryService` and `PriceHistoryRepository` exist but are never called from the
search or comparison flow. The `priceHistory.ts` in `comparisons/` references types
that make sense only when saves trigger a price record. Until wired up, the
`PriceHistory` chart on the frontend will always be empty.

### 3. No overall search timeout
Each scraper fetch has a 10-second request timeout with up to 3 retries. Because
scrapers run concurrently (`Promise.all`), one slow platform doesn't block others,
but `Promise.all` still waits for the slowest one. Worst-case latency per scraper is
~30+ seconds (1s + 2s + 4s retries + network). There's no outer deadline, so a
stuck platform can hold the entire response hostage.

### 4. RateLimiter is per-instance and not concurrency-safe
`RateLimiter` tracks only the timestamp of the last request. Two requests arriving
simultaneously will both pass `waitIfNeeded()` before either updates `lastRequestTime`,
defeating the rate limit. This could trigger 429s on the target platforms, which are
the very errors the retry logic handles — causing cascading delays.

### 5. New axios instance created on every HTTP request
`fetchWithRetry` calls `createHttpClient()` on every invocation, so a new
`axios.create()` instance (and underlying keep-alive pool) is created for each
individual HTTP request instead of being shared per-scraper.

### 6. CSS-selector fragility
All scrapers depend on specific CSS class names from each platform's HTML
(e.g. `article.prd`, `h3.name`, `div.prc` for Jumia). Any HTML restructure on
the target site silently returns 0 results with no alerting. There are no
monitoring hooks or schema-change alerts.

### 7. Transparent User-Agent
The outgoing User-Agent is `PriceCompare-NG/1.0 (Price Comparison Service)`.
Most e-commerce platforms actively block scrapers identified this way. Results
will be unreliable in production without rotating or browser-mimicking headers.

### 8. Two independent Redis connections
`SearchService` opens its own Redis connection for caching; `rateLimiter.ts`
opens a second one for rate limiting. Both could share a single client.

### 9. Cache key does not include `limit`
The Redis cache key is built from keyword + filters but not `limit`. A query with
`limit=5` and a subsequent one with `limit=20` will return the same cached results
(5 items) for the larger request, silently under-delivering.

### 10. `identifyBestValue()` and `BestValueBadge` component are unused dead code
The backend `NormalizationService.identifyBestValue()` method and the
`BestValueBadge` component in `components/comparison/` are never called — best value
logic lives entirely in `SearchResults.tsx`. These can be removed to reduce confusion.