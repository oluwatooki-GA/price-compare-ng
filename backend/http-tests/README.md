# HTTP Tests for PriceCompare NG API

This folder contains `.http` files for testing the API endpoints using REST Client extensions in VS Code or similar tools.

## Setup

1. Install the **REST Client** extension in VS Code (or use any HTTP client like Postman, Insomnia, etc.)
2. Make sure the backend server is running: `npm run dev`
3. The server should be running on `http://localhost:3000`

## Files

### `auth.http`
Tests for authentication endpoints:
- User registration
- User login
- Get current user info
- Invalid credentials handling

### `search.http`
Tests for search endpoints:
- Search by keyword
- Search by product URL
- Invalid input handling
- Validation errors

### `comparisons.http`
Tests for comparison management endpoints (requires authentication):
- Get all saved comparisons
- Save a new comparison
- Delete a comparison
- Unauthorized access handling

## Usage

### Using VS Code REST Client

1. Open any `.http` file
2. Click "Send Request" above each request
3. View the response in a new panel

### Using the Variables

The files use variables for easy configuration:
- `@baseUrl` - API base URL
- `@email` - Test user email
- `@password` - Test user password
- `@token` - JWT token (get from login response)

### Workflow

1. **Start with `auth.http`**:
   - Register a new user
   - Login to get a JWT token
   - Copy the `accessToken` from the login response

2. **Test `search.http`**:
   - Try different keyword searches
   - Test URL-based searches
   - Verify error handling

3. **Test `comparisons.http`**:
   - Replace `@token` with your actual JWT token
   - Save comparisons
   - Retrieve saved comparisons
   - Delete comparisons

## Tips

- The REST Client extension can automatically extract tokens from responses using `{{login.response.body.token.accessToken}}`
- Rate limits: 10 requests/minute (unauthenticated), 60 requests/minute (authenticated)
- All endpoints return JSON
- Check the Swagger docs at `http://localhost:3000/api-docs` for detailed API documentation

## Example Response

```json
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "createdAt": "2024-02-24T20:00:00.000Z"
  },
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "bearer"
  }
}
```
