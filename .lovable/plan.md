

# Attendance Streaks & Gamification

## Overview
Add attendance streak tracking and gamification to the platform. Students earn points and badges based on consistent attendance across co-curricular activities, meals, and workouts. Streaks and stats feed into the existing Leaderboard.

## Database Changes

**New table: `attendance_streaks`**
- `id` (uuid, PK)
- `student_id` (uuid, references profiles)
- `streak_type` (text: 'activity', 'meal', 'workout')
- `current_streak` (integer, default 0)
- `longest_streak` (integer, default 0)
- `last_recorded_date` (date)
- `updated_at` (timestamptz)

RLS: Students read own rows; admins/mods read all; system updates via trigger.

**New table: `streak_milestones`**
- `id` (uuid, PK)
- `student_id` (uuid)
- `milestone_type` (text: '7_day', '14_day', '30_day', '50_day', '100_day')
- `streak_type` (text)
- `achieved_at` (timestamptz)
- Unique constraint on (student_id, milestone_type, streak_type)

RLS: Students read own; admins/mods read all.

**Database function: `update_attendance_streak()`**
A trigger function on `attendance_records`, `meal_attendance`, and `workout_attendance` INSERT that:
1. Checks if the student has a streak row for the type
2. If last_recorded_date = yesterday, increment current_streak
3. If last_recorded_date = today, no-op
4. Otherwise, reset current_streak to 1
5. Update longest_streak if current > longest
6. Auto-insert milestone rows at 7, 14, 30, 50, 100 days
7. Auto-award badges ("On Fire" at 7-day, "Star Student" at 30-day) via user_badges insert

## UI Changes

### 1. Student Dashboard - Streak Widget (`src/components/student/StreakCard.tsx`)
- Shows current streaks for activity, meal, workout with flame icons
- Displays longest streak and next milestone progress bar
- Compact card added to the "choose" section of StudentDashboard

### 2. Leaderboard Enhancement (`src/pages/Leaderboard.tsx`)
- Add streak score to the leaderboard formula: `score = badges*3 + activities + longest_streak`
- Add a "Streaks" column showing flame icon + current streak
- New filter option: "Sort by Streak"

### 3. Streak Milestone Notifications
- When a milestone is hit, show a celebratory toast on next dashboard load
- Store seen milestones in localStorage (same pattern as request reviews)

## Files to Create/Modify
- **Create:** `src/components/student/StreakCard.tsx`
- **Modify:** `src/pages/StudentDashboard.tsx` (add StreakCard)
- **Modify:** `src/pages/Leaderboard.tsx` (add streak data to score + display)
- **Modify:** `src/lib/constants.ts` (add streak constants)
- **Migration:** Create tables, function, and triggers

## Technical Notes
- Triggers use SECURITY DEFINER to bypass RLS for streak updates
- Streak calculation is done server-side in triggers, not client-side
- The streak function handles idempotency (multiple scans same day = no double-count)
- Badge auto-awards respect the existing `block_dev_badge_insert` trigger

