# Authentication System Implementation

## Overview
Production-ready authentication system with JWT tokens, bcrypt password hashing, and secure session management.

## What Was Built

### Backend Components

#### 1. Auth Service (`src/services/auth.service.ts`)
- **Password hashing** with bcrypt (12 rounds)
- **JWT token generation** (access + refresh tokens)
- **Account security** (failed attempt tracking, account locking)
- **Session management** (token revocation, multi-device logout)
- **Password reset** with WhatsApp integration ready

**Key Functions:**
- `login()` - Authenticate with phone + password
- `signup()` - Create school + admin account
- `refreshTokens()` - Get new access token
- `logout()` / `logoutAll()` - Single or all device logout
- `changePassword()` - Update with current password verification
- `requestPasswordReset()` / `resetPassword()` - Password recovery

#### 2. Auth Middleware (`src/api/middleware/auth.middleware.ts`)
- `authenticateToken()` - Validate JWT and check revocation
- `requireRole()` - Role-based access control
- `requireAdmin` / `requireTeacherOrAdmin` - Pre-configured role checks
- `optionalAuth()` - Attach user if authenticated, don't reject

#### 3. Auth Routes (`src/api/routes/auth.ts`)
**POST Endpoints:**
- `/api/auth/login` - Authenticate and get tokens
- `/api/auth/signup` - Register new school
- `/api/auth/refresh` - Refresh access token
- `/api/auth/logout` - Logout current session
- `/api/auth/logout-all` - Logout all devices
- `/api/auth/change-password` - Update password
- `/api/auth/forgot-password` - Request reset
- `/api/auth/reset-password` - Reset with token

**GET Endpoints:**
- `/api/auth/me` - Get current user info

#### 4. Database Schema (`src/db/migrations/001_auth_schema.sql`)
**Added to `users` table:**
- `password_hash` - bcrypt hashed password
- `email` - optional email address
- `is_active` - account status
- `last_login_at` - last successful login
- `failed_login_attempts` - login attempt counter
- `locked_until` - account lock timestamp

**New tables:**
- `password_reset_tokens` - Reset token storage
- `user_sessions` - JWT session tracking with revocation

### Frontend Components

#### 1. Auth Service (`frontend/app/src/lib/auth.ts`)
- `login()` / `signup()` - API calls
- `refreshToken()` - Automatic token refresh
- `logout()` - Clear session
- `request()` - Generic authenticated API helper
- Token storage in localStorage
- Automatic retry on 401 with refresh

#### 2. Auth Context (`frontend/app/src/contexts/AuthContext.tsx`)
**React Context providing:**
- `user` - Current user data
- `isLoading` - Auth state loading
- `isAuthenticated` - Boolean auth status
- `login(phone, password)` - Login function
- `signup(data)` - Signup function
- `logout()` - Logout function
- `error` / `clearError()` - Error handling

**Usage:**
```tsx
const { user, login, isAuthenticated } = useAuth();
```

## Security Features

### Password Security
- ✅ Bcrypt hashing with 12 salt rounds
- ✅ Minimum 8 character requirement
- ✅ Failed attempt tracking (5 attempts = 30min lock)
- ✅ Password change requires current password
- ✅ All sessions revoked on password change

### JWT Security
- ✅ Short-lived access tokens (15 minutes)
- ✅ Long-lived refresh tokens (7 days, HTTP-only cookie)
- ✅ Token revocation support
- ✅ Automatic token refresh before expiry
- ✅ JTI tracking for session management

### Session Security
- ✅ Account locking after failed attempts
- ✅ Logout from all devices capability
- ✅ Session tracking in database
- ✅ CSRF protection via SameSite cookies

## API Integration

### Environment Variables (Backend)
```env
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
NODE_ENV=production
```

### Environment Variables (Frontend)
```env
VITE_API_URL=http://localhost:3000/api
```

### Login Flow
1. User submits phone + password
2. Backend verifies with bcrypt
3. Returns access token (JSON) + refresh token (HTTP-only cookie)
4. Frontend stores access token in localStorage
5. AuthContext updates with user data

### Token Refresh Flow
1. Token expires or API returns 401
2. Frontend calls `/api/auth/refresh` with cookie
3. Backend validates refresh token
4. Returns new access token
5. Request retry with new token

## Next Steps to Complete Integration

### 1. Wrap App with AuthProvider
In `main.tsx` or `App.tsx`:
```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

### 2. Update Login Form
Replace demo form in `LoginPage` with real API call:
```tsx
const { login, error } = useAuth();

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await login(phone, password);
    onNavigate('dashboard');
  } catch (err) {
    // Error handled by context
  }
};
```

### 3. Update Signup Form
Similar integration with `useAuth().signup()`

### 4. Add Protected Routes
Create wrapper component:
```tsx
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
}
```

### 5. Update API Calls
Use authenticated requests:
```tsx
const data = await authService.request('/api/schools/data');
```

## Files Created/Modified

| File | Purpose |
|------|---------|
| `src/services/auth.service.ts` | Backend auth logic |
| `src/api/middleware/auth.middleware.ts` | JWT validation |
| `src/api/routes/auth.ts` | Auth API endpoints |
| `src/db/migrations/001_auth_schema.sql` | Database schema |
| `src/index.ts` | Added auth routes |
| `frontend/app/src/lib/auth.ts` | Frontend auth service |
| `frontend/app/src/contexts/AuthContext.tsx` | React auth state |

## Testing

### Backend
```bash
# Start server
npx ts-node src/index.ts

# Test login
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"schoolName":"Test School","adminPhone":"2348012345678","password":"secure123"}'
```

### Frontend
```bash
# Start dev server
cd frontend/app && npm run dev

# Login at http://localhost:5173/login
```

## Notes
- JWT secrets should be strong random strings in production
- WhatsApp password reset messages need to be implemented in the service
- Consider adding rate limiting on auth endpoints
- HTTPS required in production for secure cookies
