

# Bringing Academic to Co-curricular Parity

After comparing both systems, here are the key features co-curricular has that academic is missing:

## Current Gaps

| Feature | Co-curricular | Academic |
|---------|:---:|:---:|
| Dashboard with live stats | Yes | Bare cards only |
| AI Weekly Summary | Yes | No |
| Pre-excuse students | Yes | No |
| PDF report export | Yes | No |
| Class messaging/chat | Yes | No |
| Attendance leaderboard | Yes | No |
| Calendar sync | Yes | No |
| QR attendance | Yes | No |

## Proposed Additions (Priority Order)

### 1. Academic Dashboard with Live Stats
Replace the bare 4-card grid with real statistics: total students across classes, overall attendance rate this week, classes with lowest attendance, upcoming periods today. Same card-based stat layout as the co-curricular dashboard.

### 2. Academic Pre-Excuse Students
New page at `/admin/academic/pre-excuse` — same flow as co-curricular: pick student, pick class/subject, pick date, add reason. Creates an "excused" record in `academic_attendance` for future sessions. Add sidebar link.

### 3. Academic AI Weekly Summary
New page at `/admin/academic/weekly-summary` — calls an edge function that queries `academic_attendance` + `academic_sessions` for the past week, feeds it to AI, returns a summary with repeat absentees, problematic subjects, and trends. Mirrors the co-curricular weekly summary.

### 4. Academic PDF Reports
Add a "Download PDF" button to the existing Academic Attendance Reports page. Reuse the pattern from `generate-pdf-report` edge function but query academic tables instead.

### 5. Class Group Messaging
Add a chat tab to the Student Academic page and Teacher Academic page — per-class-group chat similar to activity messaging. Requires a new `academic_messages` table with RLS policies.

### 6. Academic Calendar Sync
Allow students to sync their academic timetable to Google Calendar — similar to the co-curricular calendar sync card. Reuses the existing Google Calendar token infrastructure.

### 7. Academic Attendance Leaderboard
Student-facing leaderboard ranked by academic attendance percentage. Filters by class group or overall. Same podium UI as co-curricular leaderboard.

## Database Changes
- New table: `academic_messages` (class_group_id, sender_id, content, created_at) with RLS
- New table: `academic_excuses` (student_id, slot_id, excuse_date, reason, created_by) with RLS
- New edge function: `generate-academic-weekly-summary`
- New edge function: `generate-academic-pdf-report`

## New Routes & Sidebar Links
- `/admin/academic/pre-excuse` — Pre-excuse students
- `/admin/academic/weekly-summary` — AI Weekly Summary
- Add these to `academicItems` in `AdminSidebar.tsx`

## Implementation Order
1. Dashboard stats (no DB changes, quick win)
2. Pre-excuse students (new table + page)
3. AI Weekly Summary (new edge function + page)
4. PDF export (extend existing page)
5. Class messaging (new table + UI on student/teacher pages)
6. Calendar sync (reuse existing infra)
7. Leaderboard (frontend only, queries existing data)

## Technical Notes
- All new tables get RLS policies matching existing patterns (admin/moderator full access, students see own data)
- Edge functions reuse existing `LOVABLE_API_KEY` for AI calls
- Edit existing files where possible; new pages only for genuinely new features
- Sidebar updates in `AdminSidebar.tsx` to add new academic links

