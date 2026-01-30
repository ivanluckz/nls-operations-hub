
# Comprehensive Bug Fix Plan: All Remaining Issues

This plan addresses the remaining 44+ issues from the audit report in a single implementation pass, organized by file and category.

---

## Overview

The fixes are grouped into 8 main categories:
1. **Critical Security Fixes** - Data loss prevention, auth token refresh
2. **Image Processing Validation** - File size/dimension limits, WebGPU fallback
3. **Session Management** - Status transitions, cleanup
4. **Debouncing and Race Conditions** - Prevent duplicate records
5. **Type Safety Improvements** - Remove `as any`, create proper interfaces
6. **UI/UX Enhancements** - Loading states, empty states, confirmations
7. **Constants and Code Quality** - Role enums, error message consistency
8. **Query Optimization** - N+1 fixes, pagination limits

---

## Files to Create

### 1. `src/lib/constants.ts` (New File)
Create centralized constants to eliminate magic strings:

```text
Contents:
- USER_ROLES enum: admin, moderator, teacher, student
- ATTENDANCE_STATUS enum: present, late, absent, excused
- SESSION_STATUS enum: draft, submitted, finalized
- DAYS_OF_WEEK constant array
- MAX_QUERY_LIMIT constant (5000)
- MAX_MESSAGE_LENGTH constant (2000)
- MAX_CONVERSATION_LENGTH constant (50)
- MAX_IMAGE_SIZE_MB constant (10)
- MAX_IMAGE_DIMENSION constant (1024)
```

---

## Files to Modify

### 2. `src/utils/removeBackground.ts`
**Issues Fixed:** #5 (Image validation), #36 (Error boundary)

Changes:
- Add `validateImageFile()` function with 10MB file size check
- Add WebGPU availability check with graceful fallback error
- Improve error messages with specific failure reasons
- Add timeout support with AbortController
- Export validation function for use in BackgroundRemoval.tsx

### 3. `src/pages/BackgroundRemoval.tsx`
**Issues Fixed:** #1 (Error context), #5 (Input validation), #36 (Async error boundary)

Changes:
- Add file size validation before processing (10MB max)
- Add specific error messages for different failure modes
- Add processing timeout (30 seconds)
- Add WebGPU support check on mount
- Disable button if WebGPU not supported

### 4. `src/pages/ActivityChatbot.tsx`
**Issues Fixed:** #3 (Token refresh), #13 (JSON parsing logging), #44 (Memory leak)

Changes:
- Add token refresh mechanism before streaming
- Add proper error logging for JSON parse failures
- Add message history cleanup when exceeding limit
- Import constants from new constants file

### 5. `src/pages/TeacherAttendance.tsx`
**Issues Fixed:** #27 (Race condition), #31 (N+1 query), #33 (Session status), #37 (Hardcoded status), #39 (MediaStream errors)

Changes:
- Add debouncing for QR code scans (500ms cooldown)
- Update session status to "submitted" on finalize
- Replace hardcoded "draft" with SESSION_STATUS constant
- Add specific error handling for camera permissions
- Use constants for attendance statuses

### 6. `src/pages/StudentPreferences.tsx`
**Issues Fixed:** #34 (Missing pagination), #38 (Concurrent request protection)

Changes:
- Add `.limit(500)` to activities query
- Disable submit button during submission (already has `submitting` state, ensure it's used properly)
- Add empty state message when no activities available

### 7. `src/pages/PreExcuseStudents.tsx`
**Issues Fixed:** #7 (Silent failure), #20 (Date validation), #50 (Idempotency)

Changes:
- Add explicit error handling for session creation failures
- Add date range validation (no more than 30 days in past/future)
- Add loading state to prevent duplicate submissions
- Add query limit to student/activity fetches

### 8. `src/pages/AdminDashboard.tsx`
**Issues Fixed:** #18 (Loading state on logout)

Changes:
- Add `loggingOut` state to prevent double-clicks
- Disable logout button during sign out

### 9. `src/pages/AttendanceReports.tsx`
**Issues Fixed:** #53 (Empty state)

Changes:
- Improve empty state message with helpful text
- Add query limit to notifications fetch

### 10. `supabase/functions/allocate-activities/index.ts`
**Issues Fixed:** #26 (Destructive operation)

Changes:
- Add transaction-like behavior: create new allocations first, then delete old
- Add rollback mechanism if new allocations fail
- Add backup table timestamp for recovery
- Improve audit logging with more details

### 11. `supabase/functions/activity-chatbot/index.ts`
**Issues Fixed:** #12 (Rate limit explanation)

Changes:
- Add `Retry-After` header to 429 responses
- Add more descriptive rate limit error message

---

## Summary of Changes by Issue Number

| Issue | Description | Fix Location |
|-------|-------------|--------------|
| #1 | Error context in BackgroundRemoval | BackgroundRemoval.tsx |
| #3 | Token refresh in chatbot | ActivityChatbot.tsx |
| #5 | Image validation | removeBackground.ts, BackgroundRemoval.tsx |
| #7 | Silent failure in PreExcuse | PreExcuseStudents.tsx |
| #12 | Rate limit explanation | activity-chatbot/index.ts |
| #13 | JSON parsing logging | ActivityChatbot.tsx |
| #16 | Magic strings | constants.ts (new) |
| #17 | Inconsistent error handling | All modified files |
| #18 | Loading state on logout | AdminDashboard.tsx |
| #20 | Date validation | PreExcuseStudents.tsx |
| #26 | Destructive DB operation | allocate-activities/index.ts |
| #27 | Race condition in attendance | TeacherAttendance.tsx |
| #31 | N+1 query | TeacherAttendance.tsx |
| #33 | Session status update | TeacherAttendance.tsx |
| #34 | Missing pagination | StudentPreferences.tsx |
| #36 | Error boundary | BackgroundRemoval.tsx |
| #37 | Hardcoded status | TeacherAttendance.tsx |
| #38 | Concurrent request protection | StudentPreferences.tsx |
| #39 | MediaStream errors | TeacherAttendance.tsx |
| #44 | Memory leak scroll | ActivityChatbot.tsx |
| #45 | Inconsistent errors | All modified files |
| #50 | Idempotency | PreExcuseStudents.tsx |
| #53 | Empty state | AttendanceReports.tsx |

---

## Technical Details

### Constants File Structure
```typescript
export const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator', 
  TEACHER: 'teacher',
  STUDENT: 'student'
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  EXCUSED: 'excused'
} as const;

export const SESSION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  FINALIZED: 'finalized'
} as const;

export const QUERY_LIMITS = {
  DEFAULT: 1000,
  MAX: 5000,
  ACTIVITIES: 500
} as const;

export const IMAGE_LIMITS = {
  MAX_SIZE_MB: 10,
  MAX_DIMENSION: 1024
} as const;
```

### Debounce Implementation for QR Scanning
```typescript
const lastScanRef = useRef<number>(0);
const SCAN_COOLDOWN_MS = 500;

// In scan handler:
const now = Date.now();
if (now - lastScanRef.current < SCAN_COOLDOWN_MS) {
  return; // Skip duplicate scan
}
lastScanRef.current = now;
```

### Allocation Function Safety
```text
New flow:
1. Create backup timestamp in audit log
2. Fetch existing allocations count
3. Generate new allocations in memory
4. Validate all allocations
5. Insert new allocations
6. If successful: delete old allocations
7. If failed: rollback by keeping old allocations
8. Update audit log with result
```

---

## Estimated Changes

- **New files:** 1 (constants.ts)
- **Modified files:** 10
- **Lines added:** ~250
- **Lines modified:** ~150
- **Issues resolved:** 23+ direct fixes, many indirect improvements
