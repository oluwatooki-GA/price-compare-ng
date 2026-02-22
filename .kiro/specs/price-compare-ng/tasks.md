# Implementation Plan: PriceCompare NG

## Overview

This implementation plan breaks down the PriceCompare NG application into discrete, incremental tasks. The approach follows a bottom-up strategy: building core infrastructure first, then feature modules, and finally integrating everything together. Each task builds on previous work to ensure continuous progress without orphaned code.

The implementation is organized into phases:
1. Project setup and infrastructure
2. Backend core services (auth, database)
3. Scraping infrastructure
4. Search and comparison features
5. Frontend application
6. Integration and final touches

## Tasks

- [-] 1. Initialize project structure and version control
  - Initialize Git repository with proper .gitignore files
  - Create backend/ and frontend/ directories
  - Create .env.example files for both backend and frontend
  - Set up README.md with project overview
  - Make initial commit with project structure
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 2. Set up backend infrastructure
  - [~] 2.1 Create Python virtual environment and install dependencies
    - Create requirements.txt with FastAPI, SQLAlchemy, Pydantic, bcrypt, python-jose, httpx, beautifulsoup4, slowapi, redis, alembic
    - Set up virtual environment
    - Install all dependencies
    - _Requirements: 12.1_
  
  - [~] 2.2 Implement core configuration module
    - Create app/core/config.py with environment variable loading
    - Implement Settings class using Pydantic BaseSettings
    - Add validation for required environment variables
    - Include database URL, JWT secret, Redis URL, CORS origins
    - _Requirements: 12.1, 12.4, 12.5_
  
  - [~] 2.3 Implement security utilities
    - Create app/core/security.py
    - Implement password hashing functions using bcrypt
    - Implement JWT token creation and verification functions
    - Add get_current_user dependency for protected routes
    - _Requirements: 1.1, 1.2_
  
  - [~] 2.4 Set up database connection and base models
    - Create app/core/database.py with SQLAlchemy engine and session
    - Create Base model class
    - Implement get_db dependency for database sessions
    - _Requirements: 1.1_
  
  - [~] 2.5 Create shared exception classes
    - Create app/shared/exceptions.py
    - Implement PriceCompareException base class
    - Implement AuthenticationError, ValidationError, ScrapingError, RateLimitError, ResourceNotFoundError
    - _Requirements: 11.5_

- [ ] 3. Implement authentication system
  - [~] 3.1 Create User database model
    - Create app/users/models.py
    - Implement User model with id, email, hashed_password, created_at, updated_at
    - Add relationship to SavedComparison
    - _Requirements: 1.1_
  
  - [~] 3.2 Create authentication schemas
    - Create app/auth/schemas.py
    - Implement UserRegister, UserLogin, Token, UserResponse schemas
    - Add email validation and password minimum length validation
    - _Requirements: 1.4, 1.5_
  
  - [~] 3.3 Implement authentication service
    - Create app/auth/service.py
    - Implement AuthService class with register_user, authenticate_user, create_access_token, verify_token methods
    - Add password hashing on registration
    - Add credential validation on login
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [~] 3.4 Create authentication routes
    - Create app/auth/routes.py
    - Implement POST /auth/register endpoint
    - Implement POST /auth/login endpoint
    - Implement GET /auth/me endpoint (protected)
    - Add proper error handling and status codes
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 3.5 Write property test for authentication round-trip
    - **Property 1: Authentication round-trip preserves identity**
    - **Validates: Requirements 1.1, 1.2**
  
  - [ ]* 3.6 Write unit tests for authentication edge cases
    - Test password too short rejection
    - Test invalid email format rejection
    - Test wrong password authentication failure
    - _Requirements: 1.3, 1.4, 1.5_

- [~] 4. Set up database migrations
  - Create Alembic configuration
  - Generate initial migration for User model
  - Test migration up and down
  - _Requirements: 1.1_

- [ ] 5. Implement rate limiting
  - [~] 5.1 Configure slowapi rate limiter
    - Create app/core/rate_limit.py
    - Initialize Limiter with Redis storage
    - Register rate limit exception handler
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [~] 5.2 Apply rate limits to authentication routes
    - Add @limiter.limit decorators to auth endpoints
    - Set 10/minute for unauthenticated endpoints
    - Set 60/minute for authenticated endpoints
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 5.3 Write unit tests for rate limiting
    - Test unauthenticated rate limit enforcement
    - Test authenticated rate limit enforcement
    - Test 429 response format
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 6. Implement scraper infrastructure
  - [~] 6.1 Create scraper base interface
    - Create app/scrapers/base.py
    - Define ProductData dataclass
    - Define ScraperAdapter abstract base class
    - Add abstract methods: platform_name, search_products, get_product_by_url, is_valid_url
    - _Requirements: 8.1_
  
  - [~] 6.2 Implement scraper utilities
    - Create app/scrapers/utils.py
    - Implement retry logic with exponential backoff
    - Implement rate limiting per platform
    - Add timeout configuration
    - _Requirements: 4.3, 4.5_
  
  - [~] 6.3 Create scraper registry
    - Create app/scrapers/registry.py
    - Implement ScraperRegistry class to manage platform adapters
    - Add register_scraper and get_all_scrapers methods
    - _Requirements: 8.2_
  
  - [~] 6.4 Implement Jumia scraper
    - Create app/scrapers/jumia.py
    - Implement JumiaScraper class extending ScraperAdapter
    - Implement search_products method with HTML parsing
    - Implement get_product_by_url method
    - Implement is_valid_url method
    - Add price normalization logic
    - _Requirements: 4.1, 4.2_
  
  - [~] 6.5 Implement Konga scraper
    - Create app/scrapers/konga.py
    - Implement KongaScraper class extending ScraperAdapter
    - Implement search_products method with HTML parsing
    - Implement get_product_by_url method
    - Implement is_valid_url method
    - Add price normalization logic
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 6.6 Write property test for price normalization
    - **Property 10: Price normalization produces consistent format**
    - **Validates: Requirements 4.2**
  
  - [ ]* 6.7 Write property test for scraping error handling
    - **Property 11: Scraping errors are handled gracefully**
    - **Validates: Requirements 4.4**
  
  - [ ]* 6.8 Write unit tests for scraper edge cases
    - Test malformed HTML handling
    - Test network timeout handling
    - Test retry logic
    - _Requirements: 4.3, 4.4_

- [~] 7. Checkpoint - Verify scraper infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement normalization service
  - [~] 8.1 Create normalization service
    - Create app/search/normalization.py
    - Implement NormalizationService class
    - Implement calculate_similarity method using Jaccard similarity
    - Implement group_similar_products method with 0.6 threshold
    - Implement identify_best_value method considering price, rating, reviews
    - _Requirements: 2.2, 5.1, 5.2_
  
  - [ ]* 8.2 Write property test for product grouping
    - **Property 5: Similar products are grouped together**
    - **Validates: Requirements 2.2**
  
  - [ ]* 8.3 Write property test for best value identification
    - **Property 12: Lowest price is correctly identified**
    - **Property 13: Best value considers multiple factors**
    - **Validates: Requirements 5.1, 5.2**
  
  - [ ]* 8.4 Write unit tests for normalization edge cases
    - Test empty product list
    - Test single product
    - Test products with identical names
    - _Requirements: 2.2, 5.1_

- [ ] 9. Implement search service and routes
  - [~] 9.1 Create search schemas
    - Create app/search/schemas.py
    - Implement KeywordSearchRequest, UrlSearchRequest schemas
    - Implement ProductDataResponse, ComparisonResultResponse schemas
    - _Requirements: 2.1, 3.1_
  
  - [~] 9.2 Implement search service
    - Create app/search/service.py
    - Implement SearchService class
    - Implement search_by_keyword method that queries all scrapers
    - Implement search_by_url method that validates and extracts product
    - Implement validate_url method
    - Add Redis caching for search results (5-minute TTL)
    - _Requirements: 2.1, 3.1, 3.2, 3.3_
  
  - [~] 9.3 Create search routes
    - Create app/search/routes.py
    - Implement POST /search/keyword endpoint
    - Implement POST /search/url endpoint
    - Add rate limiting (10/minute unauthenticated, 60/minute authenticated)
    - Add proper error handling
    - _Requirements: 2.1, 3.1_
  
  - [ ]* 9.4 Write property test for keyword search
    - **Property 4: Keyword search queries all registered platforms**
    - **Validates: Requirements 2.1**
  
  - [ ]* 9.5 Write property test for URL validation
    - **Property 8: URL validation correctly identifies supported platforms**
    - **Validates: Requirements 3.1, 3.5, 11.3**
  
  - [ ]* 9.6 Write property test for platform failure isolation
    - **Property 7: Platform failures are isolated**
    - **Validates: Requirements 2.5, 8.4**
  
  - [ ]* 9.7 Write property test for product data completeness
    - **Property 6: Product data contains all required fields**
    - **Validates: Requirements 2.4, 5.5**
  
  - [ ]* 9.8 Write unit tests for search edge cases
    - Test empty keyword
    - Test invalid URL format
    - Test URL from unsupported platform
    - _Requirements: 3.5, 11.4_

- [ ] 10. Implement price history service
  - [~] 10.1 Create PriceHistory database model
    - Create app/comparisons/models.py (if not exists)
    - Implement PriceHistory model with id, product_url, platform, price, currency, recorded_at
    - Add composite index on (product_url, platform, recorded_at)
    - _Requirements: 6.1_
  
  - [~] 10.2 Create price history service
    - Create app/comparisons/price_history.py
    - Implement PriceHistoryService class
    - Implement record_price method
    - Implement get_price_history method
    - Implement cleanup_old_data method (90-day retention)
    - _Requirements: 6.1, 6.2, 6.4_
  
  - [~] 10.3 Integrate price history recording into search service
    - Update SearchService to record prices after scraping
    - Call price_history_service.record_price for each product
    - _Requirements: 6.1_
  
  - [ ]* 10.4 Write property test for price history recording
    - **Property 16: Price history is recorded on retrieval**
    - **Validates: Requirements 6.1**
  
  - [ ]* 10.5 Write property test for price history retrieval
    - **Property 17: Price history retrieval returns associated data**
    - **Validates: Requirements 6.2, 6.5**
  
  - [ ]* 10.6 Write unit tests for price history
    - Test cleanup of old data
    - Test retrieval with no data
    - _Requirements: 6.4_

- [~] 11. Generate and run database migrations
  - Create Alembic migration for PriceHistory model
  - Run migrations
  - Verify database schema
  - _Requirements: 6.1_

- [ ] 12. Implement comparison persistence
  - [~] 12.1 Create SavedComparison database model
    - Add SavedComparison model to app/comparisons/models.py
    - Implement with id, user_id, search_query, search_type, comparison_data (JSON), created_at
    - Add foreign key relationship to User
    - _Requirements: 7.1_
  
  - [~] 12.2 Create comparison schemas
    - Create app/comparisons/schemas.py
    - Implement SaveComparisonRequest, SavedComparisonResponse schemas
    - _Requirements: 7.1_
  
  - [~] 12.3 Implement comparison service
    - Create app/comparisons/service.py
    - Implement ComparisonService class
    - Implement save_comparison method with 50-comparison limit
    - Implement get_user_comparisons method
    - Implement delete_comparison method
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [~] 12.4 Create comparison routes
    - Create app/comparisons/routes.py
    - Implement POST /comparisons endpoint (protected)
    - Implement GET /comparisons endpoint (protected)
    - Implement DELETE /comparisons/{id} endpoint (protected)
    - Add rate limiting
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ]* 12.5 Write property test for comparison persistence
    - **Property 19: Saved comparisons are associated with users**
    - **Property 20: User retrieves only their own comparisons**
    - **Property 21: Comparison deletion removes the record**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  
  - [ ]* 12.6 Write property test for comparison limit
    - **Property 22: Comparison limit is enforced**
    - **Validates: Requirements 7.4, 7.5**
  
  - [ ]* 12.7 Write unit tests for comparison edge cases
    - Test saving comparison at limit
    - Test deleting non-existent comparison
    - _Requirements: 7.4, 7.5_

- [~] 13. Generate and run database migrations for comparisons
  - Create Alembic migration for SavedComparison model
  - Run migrations
  - Verify database schema
  - _Requirements: 7.1_

- [ ] 14. Wire up FastAPI application
  - [~] 14.1 Create main application file
    - Create app/main.py
    - Initialize FastAPI app with metadata
    - Add CORS middleware
    - Register rate limiter
    - Include all routers (auth, search, comparisons)
    - Add global exception handlers
    - _Requirements: 9.4, 11.5_
  
  - [~] 14.2 Create application startup script
    - Create run.py or use uvicorn directly
    - Add environment variable validation on startup
    - _Requirements: 12.4, 12.5_

- [~] 15. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Initialize frontend project
  - [~] 16.1 Create Vite + React + TypeScript project
    - Run npm create vite@latest frontend -- --template react-ts
    - Install dependencies
    - _Requirements: 10.1_
  
  - [~] 16.2 Install and configure TailwindCSS
    - Install tailwindcss, postcss, autoprefixer
    - Create tailwind.config.js
    - Add Tailwind directives to index.css
    - _Requirements: 10.1_
  
  - [~] 16.3 Install additional dependencies
    - Install react-router-dom, @tanstack/react-query, axios, react-hook-form, zod, @hookform/resolvers
    - _Requirements: 15.1, 15.2_
  
  - [~] 16.4 Set up project structure
    - Create directories: api/, components/, pages/, hooks/, types/, utils/
    - Create subdirectories in components/: common/, search/, comparison/, layout/
    - _Requirements: 10.1_

- [ ] 17. Implement frontend API client
  - [~] 17.1 Create Axios client configuration
    - Create src/api/client.ts
    - Configure Axios instance with base URL
    - Add request interceptor to attach JWT token
    - Add response interceptor for error handling
    - _Requirements: 15.2_
  
  - [~] 17.2 Create authentication API functions
    - Create src/api/auth.ts
    - Implement register, login, getCurrentUser functions
    - _Requirements: 1.1, 1.2_
  
  - [~] 17.3 Create search API functions
    - Create src/api/search.ts
    - Implement searchByKeyword, searchByUrl functions
    - _Requirements: 2.1, 3.1_
  
  - [~] 17.4 Create comparison API functions
    - Create src/api/comparisons.ts
    - Implement saveComparison, getUserComparisons, deleteComparison functions
    - _Requirements: 7.1, 7.2, 7.3_

- [~] 18. Create TypeScript type definitions
  - Create src/types/index.ts
  - Define ProductData, ComparisonResult, SavedComparison, User interfaces
  - Define API request/response types
  - _Requirements: 2.4, 5.5_

- [ ] 19. Implement authentication UI
  - [~] 19.1 Create authentication hook
    - Create src/hooks/useAuth.ts
    - Implement useAuth hook with TanStack Query
    - Add login, register, logout mutations
    - Add user query
    - Handle token storage in localStorage
    - _Requirements: 1.1, 1.2_
  
  - [~] 19.2 Create login page
    - Create src/pages/Login.tsx
    - Implement login form with React Hook Form + Zod validation
    - Add email and password fields
    - Display validation errors
    - Handle login submission
    - _Requirements: 1.1, 1.5, 11.1, 11.2_
  
  - [~] 19.3 Create registration page
    - Create src/pages/Register.tsx
    - Implement registration form with validation
    - Add email, password, confirm password fields
    - Display validation errors
    - Handle registration submission
    - _Requirements: 1.1, 1.4, 1.5, 11.1, 11.2_
  
  - [~] 19.4 Create protected route wrapper
    - Create src/components/ProtectedRoute.tsx
    - Check authentication status
    - Redirect to login if not authenticated
    - _Requirements: 1.2_
  
  - [ ]* 19.5 Write property test for form validation
    - **Property 28: Form validation prevents invalid submissions**
    - **Validates: Requirements 11.1, 11.2**

- [ ] 20. Implement common UI components
  - [~] 20.1 Create Button component
    - Create src/components/common/Button.tsx
    - Add variants (primary, secondary, danger)
    - Add loading state
    - Add disabled state
    - _Requirements: 10.1_
  
  - [~] 20.2 Create Input component
    - Create src/components/common/Input.tsx
    - Add error state styling
    - Add label support
    - _Requirements: 10.1, 11.2_
  
  - [~] 20.3 Create LoadingSpinner component
    - Create src/components/common/LoadingSpinner.tsx
    - Add simple spinner animation
    - _Requirements: 10.4_
  
  - [~] 20.4 Create ErrorMessage component
    - Create src/components/common/ErrorMessage.tsx
    - Display error with retry button
    - _Requirements: 10.5, 11.5_

- [ ] 21. Implement search interface
  - [~] 21.1 Create search hook
    - Create src/hooks/useSearch.ts
    - Implement useSearch hook with TanStack Query
    - Add searchByKeyword and searchByUrl mutations
    - Handle loading and error states
    - _Requirements: 2.1, 3.1_
  
  - [~] 21.2 Create SearchBar component
    - Create src/components/search/SearchBar.tsx
    - Add input field with validation
    - Add search button
    - Handle form submission
    - _Requirements: 10.1, 11.4_
  
  - [~] 21.3 Create SearchTypeToggle component
    - Create src/components/search/SearchTypeToggle.tsx
    - Toggle between keyword and URL search modes
    - Update form validation based on mode
    - _Requirements: 10.1_
  
  - [~] 21.4 Create Home page with search interface
    - Create src/pages/Home.tsx
    - Add centered search interface
    - Integrate SearchBar and SearchTypeToggle
    - Handle search submission and navigation
    - _Requirements: 10.1_
  
  - [ ]* 21.5 Write property test for keyword validation
    - **Property 29: Keyword validation enforces minimum length**
    - **Validates: Requirements 11.4**
  
  - [ ]* 21.6 Write unit tests for search components
    - Test search form submission
    - Test validation error display
    - _Requirements: 11.1, 11.2, 11.4_

- [ ] 22. Implement comparison results display
  - [~] 22.1 Create ProductCard component
    - Create src/components/comparison/ProductCard.tsx
    - Display product name, price, rating, reviews, platform
    - Add link to product URL
    - Show availability status
    - _Requirements: 5.5, 5.4_
  
  - [~] 22.2 Create BestValueBadge component
    - Create src/components/comparison/BestValueBadge.tsx
    - Display "Best Value" badge with styling
    - _Requirements: 5.1, 10.3_
  
  - [~] 22.3 Create PriceChart component
    - Create src/components/comparison/PriceChart.tsx
    - Display line chart of price history
    - Use a simple charting library (recharts or chart.js)
    - Only render if price history data available
    - _Requirements: 6.3_
  
  - [~] 22.4 Create ComparisonCard component
    - Create src/components/comparison/ComparisonCard.tsx
    - Display grid of ProductCard components
    - Highlight best value product
    - Show price differences
    - Add save comparison button (if authenticated)
    - _Requirements: 5.1, 5.3, 10.2_
  
  - [~] 22.5 Create SearchResults page
    - Create src/pages/SearchResults.tsx
    - Display list of ComparisonCard components
    - Handle loading state
    - Handle error state
    - Handle empty state
    - _Requirements: 10.4, 10.5, 10.7_
  
  - [ ]* 22.6 Write property test for loading states
    - **Property 25: Loading states are displayed during API calls**
    - **Validates: Requirements 10.4, 15.3**
  
  - [ ]* 22.7 Write property test for error states
    - **Property 26: Error states are displayed on API failures**
    - **Validates: Requirements 10.5, 15.4**
  
  - [ ]* 22.8 Write property test for empty states
    - **Property 27: Empty states are displayed for no results**
    - **Validates: Requirements 10.7**
  
  - [ ]* 22.9 Write unit tests for comparison display
    - Test best value highlighting
    - Test price difference calculation
    - Test out of stock indication
    - _Requirements: 5.1, 5.3, 5.4_

- [ ] 23. Implement saved comparisons feature
  - [~] 23.1 Create comparisons hook
    - Create src/hooks/useComparisons.ts
    - Implement useComparisons hook with TanStack Query
    - Add saveComparison, getUserComparisons, deleteComparison mutations
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [~] 23.2 Create SavedComparisons page
    - Create src/pages/SavedComparisons.tsx
    - Display list of saved comparisons
    - Add delete button for each comparison
    - Handle loading and error states
    - _Requirements: 7.2, 7.3_
  
  - [~] 23.3 Integrate save functionality into ComparisonCard
    - Add save button to ComparisonCard
    - Call saveComparison mutation on click
    - Show success/error feedback
    - Disable if limit reached
    - _Requirements: 7.1, 7.4_
  
  - [ ]* 23.4 Write unit tests for saved comparisons
    - Test save comparison
    - Test delete comparison
    - Test limit enforcement
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 24. Implement layout and navigation
  - [~] 24.1 Create Header component
    - Create src/components/layout/Header.tsx
    - Add navigation links (Home, Saved Comparisons)
    - Add login/logout button based on auth state
    - _Requirements: 10.1_
  
  - [~] 24.2 Create Footer component
    - Create src/components/layout/Footer.tsx
    - Add simple footer with copyright
    - _Requirements: 10.1_
  
  - [~] 24.3 Create Layout component
    - Create src/components/layout/Layout.tsx
    - Wrap Header, children, Footer
    - _Requirements: 10.1_
  
  - [~] 24.4 Set up React Router
    - Update src/App.tsx
    - Configure routes: /, /login, /register, /search, /saved
    - Wrap protected routes with ProtectedRoute
    - _Requirements: 10.1_
  
  - [~] 24.5 Configure TanStack Query provider
    - Wrap app with QueryClientProvider
    - Configure default query options (caching, retry)
    - _Requirements: 15.5_

- [ ] 25. Implement error sanitization
  - [~] 25.1 Create error formatting utility
    - Create src/utils/formatting.ts
    - Implement formatError function to sanitize backend errors
    - Remove technical details from error messages
    - _Requirements: 11.5_
  
  - [~] 25.2 Update API client to use error formatting
    - Update response interceptor in src/api/client.ts
    - Apply formatError to all error responses
    - _Requirements: 11.5_
  
  - [ ]* 25.3 Write property test for error sanitization
    - **Property 30: Backend errors are sanitized in frontend display**
    - **Validates: Requirements 11.5**

- [~] 26. Implement API response caching
  - Configure TanStack Query cache settings
  - Set staleTime for search results (5 minutes)
  - Set staleTime for user data (10 minutes)
  - Set staleTime for saved comparisons (1 minute)
  - _Requirements: 15.5_

- [~] 27. Add responsive styling
  - Review all components for mobile responsiveness
  - Add Tailwind responsive classes (sm:, md:, lg:)
  - Test on mobile, tablet, desktop viewports
  - _Requirements: 10.6_

- [ ] 28. Create environment configuration files
  - [~] 28.1 Create backend .env.example
    - Add DATABASE_URL, JWT_SECRET, REDIS_URL, CORS_ORIGINS placeholders
    - _Requirements: 12.3_
  
  - [~] 28.2 Create frontend .env.example
    - Add VITE_API_BASE_URL placeholder
    - _Requirements: 12.3_

- [ ] 29. Write comprehensive README
  - [~] 29.1 Add project overview section
    - Describe PriceCompare NG purpose and features
    - _Requirements: 13.3_
  
  - [~] 29.2 Add setup instructions
    - Backend setup (virtual environment, dependencies, migrations)
    - Frontend setup (npm install, environment variables)
    - Redis and PostgreSQL setup
    - _Requirements: 13.3_
  
  - [~] 29.3 Add architecture overview
    - Describe backend architecture (feature modules, services)
    - Describe frontend architecture (components, hooks)
    - Include technology stack
    - _Requirements: 13.3_
  
  - [~] 29.4 Add development guidelines
    - Git workflow and commit conventions
    - Code style guidelines
    - Testing guidelines
    - _Requirements: 13.3, 13.4_

- [ ] 30. Final integration and testing
  - [~] 30.1 Test complete user flows
    - Test registration → login → search → save comparison flow
    - Test URL search flow
    - Test saved comparisons retrieval and deletion
    - _Requirements: All_
  
  - [~] 30.2 Test error scenarios
    - Test invalid credentials
    - Test rate limiting
    - Test scraping failures
    - Test network errors
    - _Requirements: 1.3, 4.4, 9.3, 11.5_
  
  - [~] 30.3 Verify CORS configuration
    - Test frontend-backend communication
    - Ensure CORS headers are correct
    - _Requirements: 12.1_

- [~] 31. Final checkpoint - Complete application
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- The implementation follows a bottom-up approach: infrastructure → services → features → UI
- All code should be committed with meaningful commit messages following conventional commit format
- Environment variables should never be committed to version control
