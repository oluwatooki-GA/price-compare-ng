# PriceCompare NG - Project Overview

## 🎯 Project Vision

PriceCompare NG is a comprehensive price comparison platform designed specifically for the Nigerian e-commerce market. The platform enables users to search for products across multiple online retailers (Jumia, Konga) and compare prices, ratings, and availability in real-time, helping Nigerian consumers make informed purchasing decisions and save money.

## 🏗️ Architecture Overview

### High-Level System Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React/TS)    │◄──►│   (Node.js/TS)  │◄──►│   E-commerce    │
│                 │    │                 │    │   Sites         │
│  - UI Components│    │  - REST API     │    │  - Jumia        │
│  - State Mgmt   │    │  - Web Scrapers │    │  - Konga        │
│  - Routing      │    │  - Database     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

### Backend (`/backend`)

```
backend/
├── src/
│   ├── api/v1/                    # API endpoints
│   │   ├── auth/                  # Authentication routes
│   │   ├── search/                # Search & comparison logic
│   │   └── comparisons/           # Saved comparisons & price history
│   ├── scrapers/                  # Web scraping modules
│   │   ├── base.ts               # Abstract scraper interface
│   │   ├── jumia.ts              # Jumia scraper implementation
│   │   ├── konga.ts              # Konga scraper implementation
│   │   ├── registry.ts           # Scraper management
│   │   └── utils.ts              # HTTP utilities & rate limiting
│   ├── config/                   # Configuration files
│   ├── middleware/               # Express middleware
│   ├── shared/                   # Shared utilities & errors
│   └── server.ts                 # Application entry point
├── prisma/                       # Database schema & migrations
└── package.json
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── api/                      # API client layer
│   ├── components/               # React components
│   │   ├── common/              # Reusable UI components
│   │   ├── comparison/          # Product comparison components
│   │   ├── layout/              # Layout components
│   │   ├── search/              # Search-related components
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/                   # Custom React hooks
│   ├── pages/                   # Route components
│   ├── types/                   # TypeScript type definitions
│   └── utils/                   # Utility functions
└── package.json
```

## 🔧 Technology Stack

### Backend Technologies
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: SQLite with Prisma ORM
- **Web Scraping**: Cheerio for HTML parsing
- **Authentication**: JWT with bcrypt
- **Rate Limiting**: Redis-compatible in-memory store
- **Testing**: Vitest
- **API Documentation**: Swagger/OpenAPI

### Frontend Technologies
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS v4
- **UI Components**: shadcn/ui + custom components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v7
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **Animations**: Framer Motion

## 🎨 Design System

### Color Palette
- **Background**: `#0A0A0A` (Deep black)
- **Cards/Surfaces**: `#161616` (Dark gray)
- **Borders**: `#262626` (Medium gray)
- **Primary**: `#1edc6a` (Bright green)
- **Text**: White/Slate variants

### Component Architecture
- **Atomic Design**: Components organized by complexity (atoms → molecules → organisms)
- **shadcn/ui Integration**: Consistent, accessible UI components
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Dark Theme**: Optimized for low-light usage

## 🔍 Core Features & Functionality

### 1. Product Search System

#### Keyword Search
```typescript
// User searches for "PlayStation 4"
POST /api/v1/search/keyword
{
  "keyword": "PlayStation 4",
  "minPrice": 200000,
  "maxPrice": 500000,
  "platforms": ["jumia", "konga"],
  "sortBy": "price_asc"
}
```

#### URL-Based Search
```typescript
// User pastes a product URL
POST /api/v1/search/url
{
  "url": "https://jumia.com.ng/product/...",
  "minPrice": 100000
}
```

### 2. Web Scraping Architecture

#### Scraper Registry Pattern
```typescript
interface ScraperAdapter {
  platformName: string;
  searchProducts(keyword: string): Promise<ProductData[]>;
  getProductByUrl(url: string): Promise<ProductData>;
  isValidUrl(url: string): boolean;
}
```

#### Platform Implementations
- **JumiaScraper**: Extracts product data from Jumia.com.ng
- **KongaScraper**: Handles Konga.com scraping (currently problematic)
- **Extensible**: Easy to add new platforms (Amazon, etc.)

### 3. Product Normalization & Comparison

#### Similarity Algorithm
```typescript
// Jaccard similarity for product matching
calculateSimilarity("Sony PS4 Slim 500GB", "PlayStation 4 Slim 500GB")
// Returns: 0.67 (67% similar)
```

#### Grouping Logic
- Products with >60% similarity are grouped together
- Cross-platform price comparison within groups
- Best value identification based on price, rating, reviews

#### Category-Based Fallback
When similarity grouping fails, products are categorized:
- PS4 Slim, PS4 Pro, PS4 Games, etc.
- Laptops, Phones, Tablets, etc.

### 4. Authentication & User Management

#### JWT-Based Authentication
- Secure token-based authentication
- Password hashing with bcrypt
- Rate limiting (10 req/min unauthenticated, 60 req/min authenticated)

#### User Features
- Save comparison results
- Price history tracking
- Personalized search history

### 5. Advanced Filtering & Sorting

#### Backend Filters
- Price range filtering
- Platform selection
- Minimum rating threshold
- Availability filtering
- Multiple sorting options

#### Frontend Integration
- Real-time filter application
- Collapsible filter interface
- Filter state persistence

## 🗄️ Database Schema

### Core Entities

```sql
-- Users table
User {
  id: Int (Primary Key)
  email: String (Unique)
  password: String (Hashed)
  createdAt: DateTime
}

-- Saved comparisons
SavedComparison {
  id: Int (Primary Key)
  userId: Int (Foreign Key)
  searchQuery: String
  searchType: Enum (keyword, url)
  comparisonData: Json
  createdAt: DateTime
}

-- Price history tracking
PriceHistory {
  id: Int (Primary Key)
  productUrl: String
  platform: String
  price: Float
  currency: String
  recordedAt: DateTime
}
```

## 🔄 Data Flow & Processing

### Search Request Flow

1. **User Input**: Search query or product URL
2. **API Validation**: Request validation with Zod schemas
3. **Rate Limiting**: Apply user-specific rate limits
4. **Cache Check**: Check for cached results (5-minute TTL)
5. **Scraper Execution**: Parallel scraping across platforms
6. **Data Normalization**: Product similarity calculation & grouping
7. **Filter Application**: Apply user-specified filters
8. **Price Recording**: Store prices for history tracking
9. **Response Caching**: Cache results for future requests
10. **Client Response**: Return formatted comparison results

### Error Handling Strategy

```typescript
// Graceful degradation
try {
  const jumiaResults = await jumiaScraper.search(keyword);
} catch (error) {
  console.error('Jumia failed:', error);
  // Continue with other platforms
}
```

## 🚀 Performance Optimizations

### Backend Optimizations
- **Concurrent Scraping**: Parallel platform requests
- **Intelligent Caching**: 5-minute TTL with cache invalidation
- **Rate Limiting**: Prevents API abuse and respects target sites
- **Connection Pooling**: Efficient HTTP request management

### Frontend Optimizations
- **Code Splitting**: Route-based lazy loading
- **React Query**: Intelligent data caching and synchronization
- **Framer Motion**: Optimized animations with layout animations
- **Image Optimization**: Lazy loading and responsive images

## 🎯 Current Status & Implementation

### ✅ Completed Features

#### Backend Infrastructure
- [x] Express.js server with TypeScript
- [x] Prisma ORM with SQLite database
- [x] JWT authentication system
- [x] Rate limiting middleware
- [x] Swagger API documentation
- [x] Comprehensive error handling
- [x] Web scraping infrastructure
- [x] Product normalization algorithms
- [x] Price history tracking
- [x] Advanced filtering system

#### Frontend Application
- [x] React + TypeScript + Vite setup
- [x] TailwindCSS v4 styling
- [x] shadcn/ui component integration
- [x] Framer Motion animations
- [x] React Router v7 navigation
- [x] TanStack Query state management
- [x] Responsive design implementation
- [x] Dark theme with green accents
- [x] Advanced search filters
- [x] User authentication flows

#### Core Functionality
- [x] Keyword-based product search
- [x] URL-based product lookup
- [x] Jumia scraper (fully functional)
- [x] Product comparison interface
- [x] Saved comparisons management
- [x] Price history visualization
- [x] User registration/login
- [x] Protected routes

## ⚠️ Current Problems & Issues

### 1. Konga Scraper Reliability
**Problem**: Konga scraper frequently fails to return results
**Root Cause**: 
- Konga uses JavaScript-rendered content (SPA)
- Current scraper only gets HTML shell, not rendered content
- Selectors may be outdated due to site changes

**Impact**: 
- No cross-platform price comparison
- Users only see Jumia results
- Misleading "comparison" results with single products

**Potential Solutions**:
```typescript
// Option 1: Puppeteer for JavaScript rendering
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(searchUrl);
await page.waitForSelector('.product-item');
const html = await page.content();

// Option 2: Reverse engineer Konga's API
const apiResponse = await fetch('https://www.konga.com/api/search', {
  method: 'POST',
  body: JSON.stringify({ query: keyword })
});

// Option 3: Use headless browser service
const response = await browserlessAPI.scrape({
  url: searchUrl,
  waitForSelector: '.product-item'
});
```

### 2. Product Grouping Algorithm Issues
**Problem**: Products that should be compared aren't being grouped together
**Root Cause**:
- Similarity threshold (0.6) may be too strict
- Product name variations not handled well
- Different product models treated as separate items

**Examples**:
```typescript
// These should group together but don't:
"Sony PS4 Slim 500GB Console - Black"     // Jumia
"PlayStation 4 Slim 500GB - Black"        // Konga
// Similarity: 0.4 (below 0.6 threshold)

// Current result: 2 separate "comparisons"
// Expected result: 1 comparison with 2 products
```

**Potential Solutions**:
- Lower similarity threshold to 0.4-0.5
- Implement fuzzy string matching (Levenshtein distance)
- Add product model normalization
- Use machine learning for better product matching

### 3. Limited Platform Coverage
**Problem**: Only supports 2 platforms (Jumia + Konga)
**Impact**: 
- Missing other Nigerian e-commerce sites
- Limited price comparison scope
- Reduced value proposition

**Missing Platforms**:
- Slot.ng
- Jiji.ng
- PayPorte
- Dealdey
- Yudala

### 4. Search Result Quality
**Problem**: Search results sometimes include irrelevant products
**Examples**:
- Searching "PlayStation 4" returns USB hubs and cables
- Product relevance scoring not implemented
- No search result ranking algorithm

### 5. Performance & Scalability Issues
**Current Limitations**:
- No database connection pooling
- In-memory caching (not persistent)
- No CDN for static assets
- Single-server deployment
- No load balancing

### 6. User Experience Gaps
**Missing Features**:
- Product image optimization
- Advanced search filters (brand, condition, etc.)
- Price drop notifications
- Wishlist functionality
- Product reviews aggregation
- Mobile app

### 7. Data Quality Issues
**Problems**:
- Inconsistent product data extraction
- Missing product images
- Inaccurate availability status
- Currency conversion not handled
- No data validation for scraped content

## 🛠️ Technical Debt & Code Quality

### Backend Issues
- Test coverage incomplete (~60%)
- Some TypeScript `any` types remain
- Error handling could be more granular
- API versioning not fully implemented
- Database migrations need optimization

### Frontend Issues
- Component prop types could be stricter
- Some components are too large (need splitting)
- Accessibility features incomplete
- SEO optimization missing
- Bundle size not optimized

## 🚀 Next Steps & Roadmap

### Phase 1: Core Stability (Immediate - 2 weeks)

#### 1.1 Fix Konga Scraper
```typescript
// Priority: HIGH
// Implement Puppeteer-based scraping
// Add fallback mechanisms
// Improve error handling
```

#### 1.2 Improve Product Grouping
```typescript
// Priority: HIGH
// Lower similarity threshold to 0.4
// Add fuzzy matching algorithms
// Implement product model normalization
```

#### 1.3 Enhanced Error Handling
```typescript
// Priority: MEDIUM
// Add retry mechanisms for failed scrapes
// Implement circuit breaker pattern
// Better user error messages
```

### Phase 2: Feature Enhancement (2-4 weeks)

#### 2.1 Advanced Search Features
- Brand filtering
- Product condition (new/used)
- Seller ratings
- Shipping options
- Location-based filtering

#### 2.2 User Experience Improvements
```typescript
// Search suggestions & autocomplete
// Product image optimization
// Infinite scroll for results
// Advanced sorting options
// Search history
```

#### 2.3 Performance Optimization
```typescript
// Database connection pooling
// Redis caching implementation
// CDN integration
// Image lazy loading
// Bundle optimization
```

### Phase 3: Platform Expansion (1-2 months)

#### 3.1 Additional E-commerce Platforms
```typescript
// Implement scrapers for:
// - Slot.ng
// - Jiji.ng (marketplace)
// - PayPorte
// - Dealdey
```

#### 3.2 API Integrations
```typescript
// Partner with platforms for official APIs
// Implement affiliate tracking
// Add price drop notifications
```

### Phase 4: Advanced Features (2-3 months)

#### 4.1 Machine Learning Integration
```typescript
// Product matching ML model
// Price prediction algorithms
// Personalized recommendations
// Search relevance scoring
```

#### 4.2 Mobile Application
```typescript
// React Native app
// Push notifications
// Offline functionality
// Barcode scanning
```

#### 4.3 Business Features
```typescript
// Affiliate program
// Price alerts
// Bulk comparison tools
// API for third-party developers
```

### Phase 5: Scale & Monetization (3-6 months)

#### 5.1 Infrastructure Scaling
```typescript
// Microservices architecture
// Kubernetes deployment
// Auto-scaling
// Multi-region deployment
```

#### 5.2 Revenue Streams
```typescript
// Affiliate commissions
// Premium features
// API access tiers
// Sponsored listings
```

## 🔧 Development Guidelines

### Code Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Consistent formatting
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Standardized commit messages

### Testing Strategy
```typescript
// Unit tests: 80%+ coverage
// Integration tests: API endpoints
// E2E tests: Critical user flows
// Performance tests: Load testing
```

### Deployment Pipeline
```yaml
# CI/CD with GitHub Actions
stages:
  - lint_and_test
  - build
  - security_scan
  - deploy_staging
  - e2e_tests
  - deploy_production
```

## 📊 Success Metrics

### Technical KPIs
- **Uptime**: >99.5%
- **Response Time**: <2s average
- **Error Rate**: <1%
- **Test Coverage**: >85%

### Business KPIs
- **User Acquisition**: 1000+ monthly active users
- **Search Success Rate**: >90%
- **User Retention**: >60% monthly
- **Platform Coverage**: 5+ e-commerce sites

### User Experience KPIs
- **Search Completion Rate**: >85%
- **Comparison Save Rate**: >20%
- **Mobile Usage**: >60%
- **User Satisfaction**: 4.5+ stars

## 🤝 Contributing

### Development Setup
```bash
# Backend setup
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev

# Frontend setup
cd frontend
npm install
npm run dev
```

### Contribution Guidelines
1. Fork the repository
2. Create feature branch (`feature/amazing-feature`)
3. Follow code standards and add tests
4. Submit pull request with detailed description
5. Ensure CI passes and request review

## 📝 Documentation

### API Documentation
- **Swagger UI**: Available at `/api/docs`
- **Postman Collection**: Available in `/docs`
- **OpenAPI Spec**: Auto-generated from code

### Code Documentation
- **JSDoc**: Comprehensive function documentation
- **README Files**: Per-module documentation
- **Architecture Diagrams**: System design documentation

---

## 🎯 Conclusion

PriceCompare NG represents a significant opportunity in the Nigerian e-commerce space. While the foundation is solid with a well-architected system, the main challenges lie in improving scraper reliability, enhancing product matching algorithms, and expanding platform coverage.

The immediate focus should be on fixing the Konga scraper and improving product grouping to deliver the core value proposition of true cross-platform price comparison. With these issues resolved, the platform can scale to become the leading price comparison service in Nigeria.

The technical architecture is designed for scalability, and the modular approach allows for easy addition of new platforms and features. The combination of modern web technologies, comprehensive testing, and performance optimization positions the project for long-term success.

**Key Success Factors**:
1. Reliable cross-platform data extraction
2. Accurate product matching and comparison
3. Excellent user experience across devices
4. Comprehensive platform coverage
5. Strong performance and reliability

With focused execution on the outlined roadmap, PriceCompare NG can achieve its vision of becoming the go-to platform for smart shopping in Nigeria.