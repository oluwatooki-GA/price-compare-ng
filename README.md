# PriceCompare NG

A price comparison web application designed to help Nigerian consumers efficiently compare product prices, ratings, and reviews across multiple e-commerce platforms.

## Features

- **Keyword Search**: Search for products by keyword across multiple platforms
- **URL Search**: Paste a product URL to find similar products on other platforms
- **Price Comparison**: View side-by-side comparisons with best value highlighting
- **Price History**: Track price trends over time (7+ days of data)
- **Save Comparisons**: Authenticated users can save up to 50 comparisons
- **User Authentication**: Secure registration and login with JWT tokens
- **Rate Limiting**: API protection against abuse

## Supported Platforms

- Jumia Nigeria
- Konga

## Technology Stack

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: JWT (python-jose, bcrypt)
- **Web Scraping**: httpx, BeautifulSoup4
- **Rate Limiting**: slowapi
- **Migrations**: Alembic

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: TanStack Query
- **HTTP Client**: Axios
- **Form Validation**: React Hook Form + Zod
- **Routing**: React Router

## Architecture

### Backend Architecture

The backend follows a modular, feature-based architecture:

```
backend/
├── app/
│   ├── core/           # Configuration, security, dependencies
│   ├── shared/         # Shared models, exceptions, utilities
│   ├── auth/           # Authentication routes and services
│   ├── users/          # User management
│   ├── search/         # Search functionality
│   ├── comparisons/    # Comparison persistence
│   └── scrapers/       # Platform scraper adapters
```

**Key Patterns**:
- **Separation of Concerns**: Routes handle HTTP, services contain business logic
- **Adapter Pattern**: Platform scrapers implement a common interface
- **Dependency Injection**: Services injected via FastAPI's Depends mechanism

### Frontend Architecture

The frontend uses a component-based architecture with custom hooks:

```
frontend/src/
├── api/            # API client and endpoint functions
├── components/     # Reusable UI components
├── pages/          # Page-level components
├── hooks/          # Custom React hooks
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Setup Instructions

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 13+
- Redis 6+

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

5. Update the `.env` file with your configuration:
   - Set `DATABASE_URL` to your PostgreSQL connection string
   - Set `JWT_SECRET` to a secure random string (minimum 32 characters)
   - Set `REDIS_URL` to your Redis connection string
   - Update `CORS_ORIGINS` if needed

6. Run database migrations:
   ```bash
   alembic upgrade head
   ```

7. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file:
   - Set `VITE_API_BASE_URL` to your backend API URL (default: `http://localhost:8000`)

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## Development Guidelines

### Git Workflow

- **Branch Strategy**:
  - `main`: Production-ready code
  - `develop`: Integration branch
  - `feature/*`: Feature branches
  - `bugfix/*`: Bug fix branches

- **Commit Convention**: Follow conventional commits format
  - `feat(scope): description` - New features
  - `fix(scope): description` - Bug fixes
  - `docs(scope): description` - Documentation changes
  - `refactor(scope): description` - Code refactoring
  - `test(scope): description` - Adding tests
  - `chore(scope): description` - Maintenance tasks

### Code Style

- **Backend**: Follow PEP 8 guidelines
- **Frontend**: Follow Airbnb JavaScript/TypeScript style guide
- Use meaningful variable and function names
- Write clear comments for complex logic
- Keep functions small and focused

### Testing

- Write unit tests for business logic
- Write property-based tests for universal correctness
- Aim for >80% code coverage
- Run tests before committing

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI).

## Project Status

This project is currently in active development. See the implementation plan in `.kiro/specs/price-compare-ng/tasks.md` for detailed progress.

## License

This project is for educational purposes.

## Contributing

1. Create a feature branch from `develop`
2. Make your changes with clear, atomic commits
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request to `develop`

## Support

For issues and questions, please create an issue in the repository.
