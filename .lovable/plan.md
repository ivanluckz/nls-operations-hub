

# Allocations View Enhancements + Capacity Warnings + DM Latency Fix

## 1. DM Latency Fix (`src/pages/DirectMessages.tsx`)

**Problem**: Every incoming realtime message triggers `loadConversations(userId)` (line 262) — a full re-fetch of all channels, profiles, roles, and last messages. Plus two separate profile lookups per message (lines 245, 259).

**Fix**:
- **Remove `loadConversations` call from realtime handler**. Instead, update conversation list in-place: move the affected channel to the top and update its `lastMessage`/`lastAt` fields directly in state
- **Single profile fetch per incoming message**: cache sender name from the first fetch, reuse it for both notification and message display
- **Parallelize reaction loading** in `selectConversation`: move the reactions query into the same `Promise.all` as profiles/roles/badges instead of running it sequentially after

## 2. Allocations View Enhancements (`src/pages/AllocationsView.tsx`)

- **Summary stats bar**: Add Badge components above the table showing Total / Fully Assigned / Partially Assigned / Unassigned counts
- **Unassigned row highlighting**: Apply `bg-amber-50 dark:bg-amber-950/20` to rows where student has zero allocations across all days
- **Day-of-week filter**: Add a Select dropdown to filter by day — shows only students missing or having an allocation on that day
- **Color-coded activity cells**: Define a category-to-color map and apply subtle background tints to activity cells (fetch category from activities table)
- **Grade/class filter**: Add filter by `student_class` from profiles

## 3. Capacity Warnings (`src/pages/AdminDashboard.tsx` + `src/pages/ModeratorDashboard.tsx`)

- Add a "Capacity Alerts" card that queries activities where `current_enrollment >= capacity * 0.9`
- Show activity name, enrollment/capacity, and a colored progress bar (yellow ≥90%, red ≥100%)
- Clicking an activity navigates to the activity roster
- Same card added to both admin and moderator dashboards

## Files to Modify
- `src/pages/DirectMessages.tsx` — realtime handler optimization, parallel queries
- `src/pages/AllocationsView.tsx` — filters, stats bar, highlighting, color-coding
- `src/pages/AdminDashboard.tsx` — capacity alerts card
- `src/pages/ModeratorDashboard.tsx` — capacity alerts card

No database changes needed.

