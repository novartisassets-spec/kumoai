# CRITICAL FIXES FOR TA SETUP FLOW

## Issue: SQLite Error During Setup Completion

The error log shows:
```
✅ Broadsheet auto-generated
   subjectCount: 14
✅ Broadsheet assignments created from workload
   subjectCount: 14
ERROR: SQLITE_ERROR
```

This suggests the broadsheet creation succeeded but something else failed after.

## Root Causes Found:

### 1. "ALL" Subject Expansion (Lines 1224-1242 in BaseTeacherAgent.ts)
When teacher declares workload with "ALL", it expands to 14 school subjects instead of respecting teacher's choice.

### 2. Missing Workload Validation
No check ensures workload is declared BEFORE students are accepted.

### 3. SQLite Error Source
The error happens after broadsheet creation, likely during `saveStudentMapping` or `completeSetup`.

## IMMEDIATE FIXES NEEDED:

### Fix 1: Stop Auto-Expanding "ALL" to 14 Subjects

**File**: `src/agents/base/BaseTeacherAgent.ts` (around line 1224)

Current code:
```typescript
if (subjects === 'ALL') {
  // Fetch all subjects from school universe
  const school: any = await new Promise((resolve) => {
    db.getDB().get(`SELECT subjects_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
  });
  // ... expands to 14 subjects
}
```

**Problem**: This forces 14 subjects even if teacher only wants to teach a few.

**Solution**: 
1. When teacher says "ALL", ask for confirmation: "Do you really teach ALL 14 subjects?"
2. Or store "ALL" as-is and expand only when generating reports
3. Better: Don't expand at all - let teachers specify exactly what they teach

### Fix 2: Enforce Workload Declaration Order

**File**: `src/agents/base/BaseTeacherAgent.ts` (around line 1104)

Add check before accepting students:
```typescript
// Before processing students, verify workload is declared
const setupData = await TASetupRepository.getSetupState(teacherId, schoolId);
if (!setupData?.workload_json || Object.keys(setupData.workload_json).length === 0) {
  return {
    reply_text: "Before I can process your student register, I need to know what class and subjects you teach. Please tell me first! 📚\n\nFor example: 'I teach Primary 3: Math, English, and Science'",
    action: 'DECLARE_WORKLOAD',
    setup_status: {
      current_step: 'DECLARE_WORKLOAD',
      step_completed: false
    }
  };
}
```

### Fix 3: Fix SQLite Error

The SQLite error is likely due to:
- Duplicate student IDs in class_student_mapping
- Missing term_id
- Constraint violations

**File**: `src/db/repositories/ta-setup.repo.ts` (line 226-266)

Current ID generation:
```typescript
const studentId = student.student_id || `${classLevel.toUpperCase()}-${student.roll_number || student.name.toUpperCase().substring(0, 3)}`;
```

**Problem**: If two students have same roll number or similar names, ID collision occurs.

**Fix**: Use UUID or include timestamp:
```typescript
const studentId = student.student_id || `${classLevel.toUpperCase()}-${student.roll_number || Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
```

### Fix 4: Better Error Handling

**File**: `src/agents/base/BaseTeacherAgent.ts` (line 1497-1511)

Current error handler just returns generic message. Should provide specific guidance:
```typescript
} catch (error: any) {
  logger.error({ error, teacherId, schoolId, agentType }, `[${agentType}] Setup LLM error`);
  
  // Check if it's a database error
  if (error.code === 'SQLITE_ERROR') {
    return {
      agent: 'TA_SETUP',
      reply_text: 'I had trouble saving your setup data. This might be due to duplicate student names. Please check your student list and try again, or contact support.',
      action: 'NONE',
      setup_status: {
        current_step: currentStep,
        progress_percentage: progressPercentage,
        step_completed: false,
        is_setup_complete: false
      }
    };
  }
  
  return {
    agent: 'TA_SETUP',
    reply_text: 'I encountered an error. Please try again.',
    action: 'NONE',
    setup_status: {
      current_step: currentStep,
      progress_percentage: progressPercentage,
      step_completed: false,
      is_setup_complete: false
    }
  };
}
```

## TESTING CHECKLIST:

- [ ] Teacher declares specific subjects (2-3) - NOT expanded to 14
- [ ] Teacher tries to send register BEFORE declaring workload - REJECTED with helpful message
- [ ] Teacher declares "ALL" subjects - ASKED for confirmation
- [ ] Setup completes without SQLite errors
- [ ] Students appear in admin dashboard
- [ ] Broadsheet shows only declared subjects (not 14)

## RECOMMENDATION:

1. **URGENT**: Apply Fix 2 (workload order enforcement) - prevents data integrity issues
2. **HIGH**: Apply Fix 1 (stop ALL expansion) - respects teacher's actual workload
3. **MEDIUM**: Apply Fix 3 (SQLite fix) - prevents setup failures
4. **LOW**: Apply Fix 4 (better errors) - improves UX
