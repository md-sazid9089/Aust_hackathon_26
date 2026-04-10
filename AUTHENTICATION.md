# Authentication System Documentation

## Overview
GoliTransit now includes a complete authentication system with user registration, login, and JWT token management.

## Backend API Endpoints

### Register User
```
POST /auth/register
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "securePassword123",
  "confirm_password": "securePassword123"
}

Response (201 Created):
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "created_at": "2024-01-10T12:34:56",
    "updated_at": "2024-01-10T12:34:56"
  }
}
```

### Login User
```
POST /auth/login
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200 OK):
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "created_at": "2024-01-10T12:34:56",
    "updated_at": "2024-01-10T12:34:56"
  }
}
```

## Frontend Integration

### API Service Functions

```javascript
import { registerUser, loginUser, setAuthToken, initializeAuth } from './services/api';

// Register a new user
const response = await registerUser({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  password: 'securePassword123',
  confirmPassword: 'securePassword123'
});

// Login
const response = await loginUser({
  email: 'user@example.com',
  password: 'securePassword123'
});

// Set JWT token for authenticated requests
setAuthToken(response.access_token);

// Initialize auth on app startup
initializeAuth(); // Restores token from localStorage
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Security Features

1. **Password Hashing**: Passwords are hashed using bcrypt with salt
2. **JWT Tokens**: JSON Web Tokens for stateless authentication
3. **Token Expiration**: Access tokens expire after 30 minutes (configurable)
4. **Email Validation**: Email format validation using Pydantic
5. **Password Requirements**: Minimum 8 characters required

## Configuration

Database and JWT settings are configured in `config.json`:

```json
{
  "database": {
    "driver": "mysql+pymysql",
    "user": "golitransit",
    "password": "golitransit",
    "host": "db",
    "port": 3306,
    "database": "golitransit"
  },
  "jwt": {
    "secret_key": "your-secret-key-change-in-production",
    "algorithm": "HS256",
    "access_token_expire_minutes": 30
  }
}
```

## File Structure

### Backend
- `backend/database.py` - Database connection and session management
- `backend/models/user_models.py` - SQLAlchemy User ORM model
- `backend/models/auth_schemas.py` - Pydantic request/response schemas
- `backend/services/auth_service.py` - Authentication business logic
- `backend/routes/auth.py` - FastAPI authentication routes

### Frontend
- `frontend/src/pages/LoginPage.jsx` - Login form component
- `frontend/src/pages/SignUpPage.jsx` - Registration form component
- `frontend/src/services/api.js` - API client with auth functions

## Testing the System

### Using cURL

Register:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "password": "TestPass123",
    "confirm_password": "TestPass123"
  }'
```

Login:
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

## Error Handling

The API returns appropriate HTTP status codes:
- **201**: Created (successful registration)
- **200**: OK (successful login)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid credentials)
- **500**: Internal Server Error

Example error response:
```json
{
  "detail": "Invalid email or password"
}
```

## Future Enhancements

- [ ] Password reset functionality
- [ ] Email verification
- [ ] OAuth provider integration (Google, GitHub)
- [ ] Refresh token implementation
- [ ] User profile endpoints
- [ ] Admin user management
