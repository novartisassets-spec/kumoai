# 🔍 Frontend Data Visibility Troubleshooting Guide

## Problem
School universe data (classes, subjects, terms) not showing in Academic tab or Settings page, even though SA setup completed successfully.

## Quick Diagnostic Steps

### Step 1: Check Backend Logs

Restart your backend server and watch the logs when you navigate to the Academic tab:

```bash
# Terminal 1 - Watch logs
npm run dev

# You should see logs like:
# 🔍 [API] GET /classes - Request received
# 🔍 [API] GET /classes - School data retrieved
# 🔍 [API] GET /classes - Parsed classes_json
# 🔍 [API] GET /classes - Returning classes from JSON
```

**If you DON'T see these logs**, the API calls aren't reaching the backend. Check:
- Backend is running
- Frontend is pointing to correct API URL
- CORS issues in browser console

### Step 2: Check Browser Console

Open your browser's Developer Tools (F12) and check:

1. **Console Tab** - Look for red errors
2. **Network Tab** - Look for failed requests (red entries)

Filter by "Fetch/XHR" and look for these endpoints:
- `GET /api/classes`
- `GET /api/subjects?class_level=...`
- `GET /api/terms`
- `GET /api/schools/me`

Click on each request and check:
- **Status**: Should be 200
- **Response**: Should contain your data

### Step 3: Run Database Diagnostic

Run the diagnostic script to check what's actually in the database:

```bash
# First, list all schools
npx ts-node scripts/check-school-data.ts

# Then check your specific school
npx ts-node scripts/check-school-data.ts YOUR_SCHOOL_ID
```

**Expected output if data exists:**
```
📋 SCHOOL RECORD:
  Name: Test School
  ID: 123e4567-e89b-12d3-a456-426614174000
  Status: OPERATIONAL

📚 CLASSES:
  • JSS 1
  • JSS 2
  • JSS 3

📖 SUBJECTS (from JSON):
  • Mathematics
  • English Language
  • Biology

📖 SUBJECTS (from relational table):
  Found 18 subject entries:

  JSS 1:
    • Mathematics
    • English Language
    • Biology

✅ DATA COMPLETENESS SUMMARY
  ✅ School Name
  ✅ Classes (JSON)
  ✅ Subjects (JSON)
  ✅ Subjects (Table)
  ✅ Terms
```

**If classes/subjects show ❌**, your data wasn't saved properly.

### Step 4: Fix Missing Data

If the diagnostic shows missing data, run the sync endpoint:

```bash
# Get your auth token first (check browser localStorage for 'kumo_access_token')
# Or login via API:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "YOUR_ADMIN_PHONE", "password": "YOUR_PASSWORD"}'

# Then call sync endpoint:
curl -X POST http://localhost:3000/api/setup/sync-universe/YOUR_SCHOOL_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Universe data synced successfully",
  "data": {
    "schoolName": "Test School",
    "classesCount": 6,
    "subjectsCount": 12,
    "totalInserted": 72
  }
}
```

### Step 5: Verify JWT Token

If data exists in DB but frontend still shows empty, check the JWT token:

```javascript
// In browser console:
const token = localStorage.getItem('kumo_access_token');
console.log('Token:', token);

// Decode it (paste at jwt.io or use JS):
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('School ID in token:', payload.schoolId);
```

**Make sure the schoolId in the token matches the school with data.**

### Step 6: Manual SQL Check

If you prefer SQL:

```bash
# Open SQLite CLI
sqlite3 kumo.db

# Check your school
SELECT id, name, setup_status, classes_json, subjects_json 
FROM schools 
WHERE name LIKE '%Your School Name%';

# Check if subjects table has data
SELECT COUNT(*) as count 
FROM subjects 
WHERE school_id = 'YOUR_SCHOOL_ID';

# Check specific subjects
SELECT DISTINCT class_level, name 
FROM subjects 
WHERE school_id = 'YOUR_SCHOOL_ID' 
ORDER BY class_level, name;
```

## Common Issues & Solutions

### Issue 1: "No classes defined in setup" message

**Cause**: `classes_json` is null or empty in database

**Fix**: 
- If school was set up via WhatsApp before the fix, run sync endpoint
- Or manually update: `UPDATE schools SET classes_json = '["JSS 1", "JSS 2"]' WHERE id = 'YOUR_ID';`

### Issue 2: Classes show but subjects don't

**Cause**: Subjects table not populated (my earlier fix addresses this)

**Fix**: Run sync endpoint or the SA agent should now populate this automatically for new setups

### Issue 3: 401 Unauthorized errors in Network tab

**Cause**: JWT token expired or invalid

**Fix**: Logout and login again

### Issue 4: CORS errors in console

**Cause**: Frontend URL not allowed by backend CORS policy

**Fix**: Add your frontend URL to ALLOWED_ORIGINS env variable:
```bash
# .env file
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

### Issue 5: API returns 500 errors

**Cause**: Backend error

**Fix**: Check backend logs for the error message

## Testing the Fix

After applying fixes, test in this order:

1. **Refresh the page** (F5) - This refreshes JWT token if expired
2. **Navigate to Settings** - Should show universe configuration
3. **Navigate to Academic tab** - Should show class/subject dropdowns
4. **Check browser console** - Should have no red errors
5. **Check network tab** - All API calls should return 200 with data

## Still Not Working?

If you've tried everything and it still doesn't work:

1. **Restart both servers**:
   ```bash
   # Backend
   Ctrl+C
   npm run dev

   # Frontend  
   Ctrl+C
   npm run dev
   ```

2. **Clear browser cache and localStorage**:
   ```javascript
   // In browser console:
   localStorage.clear();
   location.reload();
   ```

3. **Check the actual API responses**:
   ```bash
   # Using curl with your token:
   curl http://localhost:3000/api/classes \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   curl http://localhost:3000/api/subjects \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Enable verbose logging** in backend (already done in the recent commits)

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ WhatsApp Setup (SA Agent)                                   │
│  └── Saves to:                                              │
│      • schools.classes_json ✓                               │
│      • schools.subjects_json ✓                              │
│      • subjects table ✓ (FIXED - now populates)            │
│      • academic_terms table ✓                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend API Calls                                          │
│  • GET /api/classes    → reads classes_json                │
│  • GET /api/subjects   → reads subjects table (primary)    │
│  • GET /api/terms      → reads academic_terms              │
│  • GET /api/schools/me → reads school info                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend Display                                            │
│  • Academic Tab: Uses /classes, /subjects, /terms          │
│  • Settings: Uses /setup/status or /schools/me             │
└─────────────────────────────────────────────────────────────┘
```

## Key Files Modified

1. **src/agents/sa/index.ts** - Added subjects table population
2. **src/api/routes/setup.ts** - Added sync endpoint + better logging
3. **src/api/routes/dashboard.ts** - Added logging + universe data in /schools/me
4. **scripts/check-school-data.ts** - Diagnostic script

---

**Last Updated**: February 16, 2026
**Status**: Fix applied, awaiting verification
