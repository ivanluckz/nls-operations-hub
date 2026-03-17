

# Implementation Plan

This is a large, multi-part request. Here is the breakdown of all changes needed:

---

## Part 1: Add Class Selection for Students

**Database Changes:**
- Add `student_class` column (text, nullable) to the `profiles` table
- Valid classes: 7A, 7B, 7C, 7D, 7E, 8A, 8B, 8C, 8D, 8E, 8F

**UI Changes:**
- Create a `ClassSelectionCard` component (similar to `HouseSelectionCard`) that shows on the student dashboard's "choose" section
- Students pick their class (7A-E or 8A-F) which saves to their profile
- This card appears on every login until a class is selected

---

## Part 2: Add Mentor Selection for Students

**Database Changes:**
- Add `mentor_id` column (uuid, nullable) to the `profiles` table — references the teacher who is the student's mentor

**UI Changes:**
- Create a `MentorSelectionCard` component on the student dashboard
- Lists all teachers (users with teacher role) for students to select as their mentor
- When a teacher is selected as mentor by at least one student, they gain additional capability (take lunch attendance)

**Mentor Lunch Attendance:**
- On the `ModeratorDashboard` (which mentors/moderators use), the lunch QR scanning feature is already present
- Teachers selected as mentors will also need the `moderator` role added so they can access the moderator dashboard and take lunch attendance
- Alternative approach: Instead of auto-promoting, add a dedicated "Mentor Dashboard" or allow teachers with mentees to scan lunch QR codes on the teacher dashboard

**Recommended approach:** Add a `mentor_lunch` section to the TeacherDashboard for teachers who have mentees, rather than auto-granting moderator role (which would be a security risk). The lunch scanning component (`MealQRScanner`) can be reused.

---

## Part 3: Assign RL Coach Role to Specific Users

**Data Operation (not schema change):**
- For the 13 listed email addresses, change their role from `teacher` to `rl_coach` in the `user_roles` table
- Note: One email has a typo (`ntare-louiselund.org` missing 'n') — will use the correct version

---

## Part 4: RL Coach House-Based Dinner Attendance

**Current state:** RL coaches already scan meals (breakfast, lunch, dinner) on `RLCoachDashboard`. But dinner is not house-based.

**Changes needed:**
- When RL coaches select "Dinner," add a house selector so they choose which house they're taking attendance for
- The dinner scan then filters/records by house
- Add `house_id` column to `meal_attendance` table (nullable) to track which house a dinner scan was for
- Update the RL Coach Dashboard dinner flow: first pick own house or another house, then scan

---

## Part 5: Morning Workout Attendance — Specific Users Only

**Current state:** All RL coaches can take workout attendance.

**Changes needed:**
- The 5 specified users (praveen.rana, reverien.kiruzi, peter.otema, mauritz.viljoen, emma.doellefeld) should be the ones taking morning workout attendance
- Since 3 of these are in the RL coach list and 2 are not, the simplest approach is to add a `can_take_workout` flag or just grant RL coach role to all 5
- The workout tab on the RL Coach Dashboard should remain accessible to these users

**Recommended:** Grant RL coach role to all 5 workout users (praveen.rana, mauritz.viljoen, emma.doellefeld are not in the RL coach list but need workout access). This means they get the full RL coach dashboard.

---

## Part 6: Fix AI Chatbots

- Check for any errors in the activity chatbot and admin AI — no console errors were found, but will review the edge function and client code for issues and fix any found

---

## Summary of Database Migrations

1. `ALTER TABLE profiles ADD COLUMN student_class text;`
2. `ALTER TABLE profiles ADD COLUMN mentor_id uuid;`
3. `ALTER TABLE meal_attendance ADD COLUMN house_id uuid;`

## Summary of Data Operations

1. Update 13 RL coach users: change role from `teacher` to `rl_coach`
2. Update 2 additional workout users (mauritz.viljoen, emma.doellefeld): change role to `rl_coach`

## New UI Components

1. `ClassSelectionCard` — student picks class (7A-E, 8A-F)
2. `MentorSelectionCard` — student picks their mentor teacher
3. Lunch scanning on Teacher Dashboard for mentors
4. House selector in RL Coach dinner scanning flow

## Files to Create/Modify

- **Create:** `src/components/student/ClassSelectionCard.tsx`, `src/components/student/MentorSelectionCard.tsx`
- **Modify:** `src/pages/StudentDashboard.tsx` (add new cards), `src/pages/R