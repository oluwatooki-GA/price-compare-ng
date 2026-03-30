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
| **💾 Save Comparisons** | Keep track of products you're interested in (up to 50 saved items) |
| **⭐ Best Value Badge** | Automatically highlights the best deal based on price, rating, and availability |
| **📱 Mobile Responsive** | Fully optimized for mobile with animated hamburger menu |
| **🔒 Secure Auth** | JWT-based authentication with bcrypt password hashing |
| **🔄 Redis Caching** | Fast search results with intelligent caching |

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Frontend
        UI["React UI"]
        Hooks["Custom Hooks"]
        Query["TanStack Query"]
    end

    subgraph Backend
        Routes["Express Routes"]
        Service["Search Service"]
        Scraper1["Jumia Scraper"]
        Scraper2["Konga Scraper"]
        Scraper3["Jiji Scraper"]
    end

    subgraph Data
        Redis[("Redis Cache")]
        DB[("PostgreSQL DB")]
    end

    subgraph External
        Jumia["Jumia.com.ng"]
        Konga["Konga.com"]
        Jiji["Jiji.ng"]
    end

    UI --> Hooks --> Query -->|"HTTP/JSON"| Routes
    Routes --> Service -->|"GET/SET"| Redis
    Routes -->|"SQL"| DB
    Service --> Scraper1 & Scraper2 & Scraper3
    Scraper1 -->|"Cheerio"| Jumia
    Scraper2 -->|"Cheerio"| Konga
    Scraper3 -->|"Cheerio"| Jiji
```

### Design Patterns

- **Adapter Pattern** - Platform scrapers extend a base `ScraperAdapter` class for easy extensibility
- **Service Layer** - Business logic separated from route handlers for reusability
- **Repository Pattern** - Data access abstracted through Prisma ORM
- **Rate Limiting** - Redis-backed rate limiting with fallback to in-memory storage

### Tech Stack

**Backend:** Express.js, TypeScript, Prisma ORM, PostgreSQL, Redis, JWT, Cheerio

**Frontend:** React 19, Vite, TailwindCSS, Framer Motion, TanStack Query, React Router

**Infrastructure:** Docker, Docker Compose

## 🚀 Quick Start with Docker

The easiest way to run this project is using Docker Compose:

```bash
# Clone the repo
git clone https://github.com/oluwatooki-GA/price-compare-ng.git
cd price-compare-ng

# Start all services (postgres, redis, backend, frontend)
docker compose up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
# API Docs: http://localhost:3000/api-docs
```

That's it! Docker handles all dependencies including PostgreSQL and Redis.

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React app with Vite HMR |
| Backend | 3000 | Express API |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Caching & rate limiting |

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
│   │   ├── api/v1/        # Route handlers + service layer
│   │   ├── scrapers/      # Platform adapters (Jumia, Konga, Jiji)
│   │   ├── middleware/    # Auth, rate limiting, error handling
│   │   └── config/        # Environment validation
│   ├── prisma/           # Database schema and migrations
│   ├── Dockerfile        # Container definition
│   └── .env.sample       # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level pages
│   │   ├── hooks/        # Custom React hooks
│   │   └── api/          # API client functions
│   └── Dockerfile        # Container definition
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
```

**Frontend (`frontend/.env`):**
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## 🧪 Testing

```bash
# Backend tests (inside container)
docker compose exec backend npm test

# Frontend linting
docker compose exec frontend npm run lint
```

## 🔮 Future Enhancements

- [ ] Price history tracking and alerts
- [ ] Email notifications for price drops
- [ ] Chrome extension for one-click price comparisons
- [ ] Support for more Nigerian e-commerce platforms
- [ ] Product review aggregation

## 💡 What I Learned

Building this project taught me:

- **Web Scraping Challenges** - Handling dynamic content, rate limits, and HTML parsing
- **Database Design** - Designing schemas for many-to-many relationships
- **Type Safety** - Leveraging TypeScript across the full stack
- **State Management** - Using TanStack Query for server state vs React state
- **Authentication Flow** - Implementing secure JWT auth with proper token management
- **Docker Deployment** - Containerizing full-stack applications with orchestration
- **Caching Strategies** - Implementing Redis for performance optimization

## 📄 License

MIT License - feel free to use this project for learning or inspiration.

---

<div align="center">
Built with ❤️ for Nigerian shoppers
</div>
