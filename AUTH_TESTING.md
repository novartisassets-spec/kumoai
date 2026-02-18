# Authentication System - Testing Guide

## ✅ Integration Complete!

The authentication system has been fully integrated with:
- ✅ Backend auth API (JWT + bcrypt)
- ✅ Frontend AuthContext with useAuth hook
- ✅ Protected routes wrapper
- ✅ Login/Signup forms connected to real API
- ✅ Logout functionality in sidebar
- ✅ Auto token refresh
- ✅ Session persistence

## 🚀 How to Test

### 1. Start the Backend Server
```bash
cd C:/Users/uchec/vs-kumo/kumo
npx ts-node src/index.ts
```

**Expected output:**
- Database initialized
- API Server running on port 3000
- Auth routes available at `/api/auth/*`

### 2. Start the Frontend Server
```bash
cd C:/Users/uchec/vs-kumo/kumo/frontend/app
npm run dev
```

**Expected output:**
- Vite dev server running on http://localhost:5173

### 3. Test Signup Flow

1. Navigate to http://localhost:5173
2. Click "Enter the KUMO Realm" or "Create one" (signup)
3. Fill in:
   - School Name: "Test School"
   - Email: (optional) "test@school.edu"
   - Admin WhatsApp: "2348012345678"
   - Click Continue
   - Password: "SecurePass123"
   - Confirm Password: "SecurePass123"
4. Click "Create Account"

**Expected:**
- Account created in database
- Auto-redirect to Dashboard
- Sidebar shows school name

### 4. Test Login Flow

1. Logout using the "Logout" button in sidebar
2. Navigate to http://localhost:5173/login
3. Enter:
   - WhatsApp Number: "2348012345678"
   - Password: "SecurePass123"
4. Click "Sign In"

**Expected:**
- Login successful
- Redirect to Dashboard
- Sidebar shows user info

### 5. Test Protected Routes

1. While logged in, try accessing any dashboard page - should work
2. Logout
3. Try accessing http://localhost:5173/dashboard

**Expected:**
- Redirected to login page
- After login, redirected back to dashboard

### 6. Test Token Refresh

1. Login and stay on dashboard
2. Wait 15 minutes (or manually delete token from localStorage)
3. Try navigating to another page

**Expected:**
- Token automatically refreshed
- Session continues seamlessly

## 📊 API Endpoints Available

- `POST /api/auth/signup` - Create school + admin
- `POST /api/auth/login` - Authenticate
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/me` - Get current user info

## 🔒 Security Features Active

- ✅ Password hashing with bcrypt (12 rounds)
- ✅ JWT access tokens (15 min expiry)
- ✅ HTTP-only refresh tokens (7 days)
- ✅ Failed login attempt tracking
- ✅ Account locking after 5 failed attempts
- ✅ Session management & revocation

## 📝 Test Credentials

After signup, use these credentials:
- **Phone:** 2348012345678
- **Password:** (whatever you set during signup)

## 🐛 Troubleshooting

**Issue:** "Cannot find module" errors
**Fix:** Run `npm install` in both backend and frontend directories

**Issue:** Database errors
**Fix:** Check that `./kumo.db` exists and schema migrations ran

**Issue:** CORS errors
**Fix:** Ensure FRONTEND_URL in .env matches your frontend URL

**Issue:** JWT errors
**Fix:** Make sure JWT_SECRET and JWT_REFRESH_SECRET are set in .env

## 🎯 Next Steps

After confirming auth works:
1. ✅ Connect school data to authenticated user
2. ✅ Load school-specific data in dashboard
3. ✅ Implement role-based UI (admin vs teacher views)
4. ✅ Add password reset via WhatsApp
5. ✅ Teacher/parent access token management

**Ready to test!** Start both servers and try the signup flow.
