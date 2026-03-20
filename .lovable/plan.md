

# Update DevBot & AdminBot with Streak Features

## Changes

### 1. `src/lib/dev-ai-actions.ts` (line ~505)
Update the **Leaderboard** bullet and add a new **Attendance Streaks** bullet:

- **Leaderboard** line → `Leaderboard: Student engagement tracking. Score formula: (badges × 3) + unique_activities + max_longest_streak. Includes streak column with flame icons.`
- Add new bullet: `**Attendance Streaks**: Automated streak tracking across activities, meals, and workouts via \`attendance_streaks\` table (current_streak, longest_streak, last_recorded_date). Milestones at 7/14/30/50/100 days stored in \`streak_milestones\`. Auto-awards badges: "On Fire" (7-day), "Star Student" (30-day). Server-side trigger \`update_attendance_streak()\` handles increments, resets, and idempotency.`

### 2. `src/pages/AdminAI.tsx` (line ~313)
Same updates to the AdminBot's PLATFORM FEATURES:

- Update **Allocations** or add after existing bullets:
  - New bullet for **Attendance Streaks** with same content as above
  - Update any Leaderboard reference to include streak scoring

Two file edits, ~4 lines each.

