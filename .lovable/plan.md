

Here are some feature ideas based on the current state of the project:

## 1. Student Swap Marketplace
Let students browse and request activity swaps with each other directly, instead of going through admin. A student posts "I want to swap out of Basketball" and another student can offer to trade spots — admin just approves.

## 2. Attendance Streak & Gamification
Track consecutive attendance streaks per student. Show streaks on the student dashboard, award badges (e.g., "10-day streak"), and display a school-wide leaderboard. Ties into the existing leaderboard page.

## 3. Parent/Guardian Portal
A read-only view for parents to see their child's activity schedule, attendance record, and any flags. Requires a new role and simple dashboard — no editing, just visibility.

## 4. Activity Waitlist System
When an activity is full, students can join a waitlist. If someone drops or gets moved, the next student is auto-allocated and notified. Reduces manual admin work.

## 5. Weekly Digest Email
Auto-generate and send a weekly summary email to students (or teachers) with their upcoming schedule, attendance stats, and any pending requests. Could use an edge function on a cron schedule.

## 6. Teacher Substitution Management
Allow admins to assign substitute teachers to activities when the regular teacher is unavailable. Track substitution history and notify affected students.

## 7. Activity Photo Gallery
Let teachers upload photos from activities. Students can view them on their dashboard. Uses storage buckets already available through the backend.

## 8. Smart Schedule Conflict Detection
When allocating students, automatically detect and flag time conflicts across activities, meals, and other commitments. Surface warnings before finalizing allocations.

