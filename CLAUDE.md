# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Express.js + TypeScript)
```bash
cd backend

# Development
npm run dev              # Start development server with ts-node-dev (port 3000)
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled server

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio

# Testing
npm test                 # Run all tests with vitest
npm run test:watch       # Run tests in watch mode
```

### Frontend (React + Vite)
```bash
cd frontend

# Development
npm run dev              # Start dev server (port 5173)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Running Tests
- Backend tests use Vitest with test files in `backend/src/**/*.test.ts`
- Run specific test: `npm test -- <test-file-pattern>`
- Tests use property-based testing approach (fast-check) for universal correctness

## Architecture Overview

### Backend: Modular Feature-Based Architecture

```
backend/src/
├── config/         # Environment validation, security (JWT/password), database
├── shared/         # Error classes, types, utilities shared across modules
├── middleware/     # Express middleware (rate limiting, error handling)
├── api/v1/
│   ├── auth/       # Authentication: routes + service layer
│   ├── search/     # Search orchestration: routes + service + normalization
│   └── comparisons/# Comparison persistence: routes + service + price history
└── scrapers/       # Platform adapters (Jumia, Konga, Jiji, Temu)
```

**Key Pattern: Service Layer Separation**
- Routes (`routes.ts`): Handle HTTP concerns only (validation, auth, responses)
- Services (`service.ts`): Contain business logic, can be used independently
- Example: `SearchService` coordinates scrapers and normalization, used by routes

**Key Pattern: Scraper Adapter Registry**
- All platform scrapers extend `ScraperAdapter` abstract class (`scrapers/base.ts`)
- `ScraperRegistry` singleton manages platform registration
- To add a platform: Extend `ScraperAdapter`, register in `scrapers/registry.ts`
- Each scraper implements: `searchProducts()`, `getProductByUrl()`, `isValidUrl()`

### Frontend: Component + Custom Hooks Architecture

```
frontend/src/
├── api/            # API client and endpoint functions (auth.ts, search.ts, comparisons.ts)
├── components/
│   ├── common/     # Reusable UI (Button, Input, LoadingSpinner, ErrorMessage)
│   ├── search/     # Search-specific (SearchBar, SearchTypeToggle, SearchFilters)
│   ├── comparison/ # Results display (ProductCard, ComparisonCard, BestValueBadge, PriceChart)
│   └── layout/     # Header, Footer, Layout wrapper
├── pages/          # Route-level components (Home, Login, Register, SearchResults, SavedComparisons)
├── hooks/          # Custom React hooks (useAuth, useSearch, useComparisons)
└── types/          # TypeScript definitions shared across frontend
```

**Key Pattern: API Client with Axios**
- `api/client.ts`: Configured Axios instance with JWT interceptor
- Endpoint files (`auth.ts`, `search.ts`, etc.): Thin wrappers around the client
- TanStack Query used in custom hooks for data fetching and caching

## Database Schema

Uses Prisma ORM with SQLite (development), PostgreSQL (production recommended).

Key models:
- `User`: Authentication with email/password
- `PriceHistory`: Tracks prices over time (90-day retention)
- `SavedComparison`: User-saved comparisons (50 per user limit)

## Important Implementation Details

### Search Flow
1. `SearchService.searchByKeyword()` queries all registered scrapers concurrently
2. Results normalized via `NormalizationService.groupSimilarProducts()` (Jaccard similarity, threshold 0.6)
3. Best value calculated considering price, rating, review count
4. Results cached in-memory (5-minute TTL)

### Rate Limiting
- Redis-backed rate limiting via `express-rate-limit` + `rate-limit-redis`
- Unauthenticated: 10 requests/minute per IP
- Authenticated: 60 requests/minute per user

### Scraping
- Uses axios + cheerio for HTML parsing
- `scrapers/utils.ts`: Retry logic with exponential backoff, per-platform rate limiting
- Platform failures isolated (one platform down doesn't break search)

### Price History
- Currently disabled in `SearchService` (see TODO comments in `service.ts`)
- `PriceHistoryService` exists but not integrated due to incomplete implementation

## Environment Variables

**Backend (.env)**:
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: Minimum 32 characters
- `REDIS_URL`: Redis connection for rate limiting
- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `PORT`: Default 3000

**Frontend (.env)**:
- `VITE_API_BASE_URL`: Backend API base URL (default: `http://localhost:3000/api/v1`)

## Common Patterns

- **Adding a new scraper**: Extend `ScraperAdapter`, implement required methods, register in `scraperRegistry`
- **Adding protected routes**: Add to routes file with `authenticateToken` middleware, wrap frontend route with `<ProtectedRoute>`
- **Error handling**: Use custom error classes from `shared/errors.ts`, global handler in `middleware/errorHandler.ts`
- **Testing**: Test files co-located with source (`*.test.ts`), property tests use fast-check