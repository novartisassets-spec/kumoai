# KUMO Data Flow Analysis & Fix

## Problem Statement
School setup via WhatsApp (SA Agent) completes successfully, but frontend dashboard shows empty data - no classes, no subjects, no terms visible.

## Root Cause Analysis

### Data Flow Mismatch

#### 1. SA Agent Setup Flow (WhatsApp-based)
**Location:** `src/agents/sa/index.ts` lines 2688-2715

When school setup is completed via WhatsApp conversation with the SA agent:
- ✅ Saves to `schools.classes_json` 
- ✅ Saves to `schools.subjects_json`
- ✅ Saves to `schools.grading_config`
- ✅ Saves to `academic_terms` table
- ✅ Saves to `users` table (teachers)
- ❌ **DOES NOT populate `subjects` table**

#### 2. Frontend API Routes
**Location:** `src/api/routes/dashboard.ts`

The dashboard queries data in this priority order:

**Subjects Endpoint (`/api/subjects`):**
```typescript
// 1. First tries subjects table
SELECT * FROM subjects WHERE school_id = ?

// 2. Only falls back to JSON if subjects table empty
SELECT subjects_json FROM schools
```

**Classes Endpoint (`/api/classes`):**
```typescript
// 1. First tries schools.classes_json
SELECT classes_json FROM schools

// 2. Falls back to students table
SELECT DISTINCT class_level FROM students
```

### The Disconnect

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SA Agent (WhatsApp)              Setup API (Frontend)     │
│  ───────────────────              ───────────────────      │
│  • schools.classes_json    ✓      • subjects table    ✓   │
│  • schools.subjects_json   ✓      • academic_terms    ✓   │
│  • academic_terms table    ✓                                │
│  • users table (teachers)  ✓                                │
│  • subjects table          ✗      ← MISSING!               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND DASHBOARD                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard API queries:                                     │
│  • GET /api/subjects → queries subjects table → EMPTY       │
│  • GET /api/classes  → queries classes_json   → WORKS       │
│  • GET /api/terms    → queries academic_terms → WORKS       │
│                                                             │
│  Result: Only classes visible, subjects missing!            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## The Fix

### 1. Modified SA Agent (`src/agents/sa/index.ts`)

Added universe table population before marking setup complete:

```typescript
// ⑦ Populate subjects table for frontend compatibility
const classesUniverse = payload.universe_config?.classes_universe || [];
const subjectsUniverse = payload.universe_config?.subjects_universe || [];

if (classesUniverse.length > 0 && subjectsUniverse.length > 0) {
    // Clear existing subjects for this school to avoid duplicates
    await db.getDB().run(`DELETE FROM subjects WHERE school_id = ?`, [schoolId]);
    
    // Insert subjects for each class combination
    for (const cls of classesUniverse) {
        for (const subj of subjectsUniverse) {
            await db.getDB().run(
                `INSERT INTO subjects (id, school_id, name, class_level, is_core, code)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), schoolId, subj, cls, 1, subj.substring(0, 3).toUpperCase()]
            );
        }
    }
}
```

### 2. Added Sync Endpoint (`src/api/routes/setup.ts`)

New endpoint to fix existing schools:

```typescript
POST /api/setup/sync-universe/:schoolId
```

This endpoint:
1. Reads `classes_json` and `subjects_json` from schools table
2. Clears existing subjects for the school
3. Populates subjects table with cross-product of classes × subjects
4. Returns sync statistics

## Data Flow After Fix

```
┌─────────────────────────────────────────────────────────────┐
│               COMPLETE DATA FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SA Agent Setup (WhatsApp)                                  │
│  │                                                          │
│  ├──► schools.classes_json ─────┐                          │
│  ├──► schools.subjects_json ────┤                          │
│  ├──► schools.grading_config    │                          │
│  ├──► academic_terms table      │                          │
│  ├──► users table (teachers)    │                          │
│  └──► subjects table ◄──────────┘ NEW! Populated now       │
│         (class × subject combinations)                     │
│                                                             │
│  Setup API Save (Frontend)                                  │
│  │                                                          │
│  ├──► schools table                                         │
│  ├──► subjects table                                        │
│  ├──► academic_terms table                                  │
│  └──► setup_state table                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND DASHBOARD                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  All endpoints now return data:                            │
│  • GET /api/subjects  → subjects table   ✓                │
│  • GET /api/classes   → classes_json     ✓                │
│  • GET /api/terms     → academic_terms   ✓                │
│  • GET /api/dashboard → all stats        ✓                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## How to Fix Existing Schools

If you have schools that were set up before this fix:

### Option 1: Use the Sync API (Recommended)

```bash
# Get auth token first
POST /api/auth/login

# Then call sync endpoint
POST /api/setup/sync-universe/:schoolId
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "message": "Universe data synced successfully",
  "data": {
    "schoolName": "Example School",
    "classesCount": 6,
    "subjectsCount": 12,
    "totalInserted": 72
  }
}
```

### Option 2: Manual SQL

```sql
-- For a specific school
DELETE FROM subjects WHERE school_id = 'YOUR_SCHOOL_ID';

-- Then manually insert based on schools.classes_json and schools.subjects_json
-- Or re-run the setup flow
```

## Verification

After fix, verify data is visible:

```bash
# Check schools table has JSON data
SELECT id, name, classes_json, subjects_json, setup_status 
FROM schools WHERE id = 'YOUR_SCHOOL_ID';

# Check subjects table is populated
SELECT COUNT(*) as subject_count 
FROM subjects WHERE school_id = 'YOUR_SCHOOL_ID';

# Check academic_terms table
SELECT * FROM academic_terms WHERE school_id = 'YOUR_SCHOOL_ID';
```

## Files Modified

1. **src/agents/sa/index.ts**
   - Added subjects table population in `handleSetup` method
   - Lines ~2870-2930

2. **src/api/routes/setup.ts**
   - Added `/api/setup/sync-universe/:schoolId` endpoint
   - Lines ~354-420

## Key Takeaways

1. **Always populate both JSON and relational tables** when saving universe/config data
2. **Frontend APIs prioritize relational tables** over JSON columns
3. **Provide migration/sync endpoints** for backward compatibility
4. **Log data flow** at critical points to debug visibility issues

## Related Database Schema

### schools table
```sql
CREATE TABLE schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    admin_phone TEXT NOT NULL,
    setup_status TEXT DEFAULT 'PENDING_SETUP',
    school_type TEXT DEFAULT 'SECONDARY',
    grading_config TEXT DEFAULT '{}',
    classes_json TEXT DEFAULT '[]',     -- Universe classes
    subjects_json TEXT DEFAULT '[]',    -- Universe subjects
    config_json TEXT DEFAULT '{}'
);
```

### subjects table
```sql
CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    class_level TEXT,        -- Which class this subject belongs to
    is_core BOOLEAN DEFAULT 1,
    aliases TEXT            -- JSON array of alternative names
);
```

### academic_terms table
```sql
CREATE TABLE academic_terms (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    term_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL
);
```

---

**Fix Applied:** February 16, 2026
**Status:** Ready for testing
