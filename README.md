# NLS Operations Hub

Internal school operations platform for NLS (Ntare-Louise Nlund School), Kigali, Rwanda.

> **Internal Tools Hackathon 2026 Submission**

---

## The Problem

NLS middle school manages **400+ students** across **20+ weekly co-curricular activities** — and before this system, nearly every piece of that operation ran on paper, spreadsheets, and back-and-forth emails:

| Before | Pain | Time lost/week |
|---|---|---|
| Activity allocation | Manual spreadsheet matching of student preferences to capacity | 4–6 hrs (admin) |
| Attendance | Paper sign-in sheets, manually entered into Excel | 3–4 hrs (teachers + admin) |
| Weekly reporting | Admin compiled stats from multiple sources by hand | 2+ hrs |
| Medical tracking | Nurse's notebook, no searchable history | — |
| Meal attendance | Kitchen staff with clipboards | 1–2 hrs |
| Teacher assignment | Email threads to confirm who covers which activity | 1 hr |

**Total: ~12 hours of avoidable admin work every week.**

---

## The Solution

A unified internal operations platform — one app, seven role-specific dashboards, zero paper.

### Core Modules

**Smart Activity Allocation**
- Students submit ranked preferences; the system allocates them to activities respecting capacity limits
- Conflict detection, manual override, full audit log for every change
- What took a coordinator half a day now runs in minutes

**Digital Attendance (QR + Bulk)**
- Teachers open the app, scan or tap — attendance submitted in seconds
- Pre-excuse workflow for known absences before sessions start
- Sessions move through `draft → submitted → finalized` states with full audit trail

**AI-Powered Weekly Summary**
- One click generates a natural-language report: attendance issues, repeat absentees, problematic activities, trend flags
- Replaces 2+ hours of manual weekly compilation

**Multi-Role Dashboards**

| Role | What they see |
|---|---|
| Admin | Full operations: users, allocations, attendance, meals, workouts, AI insights |
| Moderator | Activity management, allocations, attendance oversight |
| Teacher | Their activities' rosters and attendance submission |
| RL Coach | Workout session tracking and reports |
| Medical | Student visit log, conditions, clearance status |
| Kitchen | Meal attendance, QR scanning, daily reports |
| Student | Their schedule, preferences, leaderboard, streaks |

**Data Export**
- One-click Excel (5 sheets: Summary, Roster, Teachers, Allocations, Attendance) or CSV
- Every report exportable — no BI tool required

**Real-Time Messaging**
- Activity-level announcements from teachers to enrolled students
- Direct messages between any staff/student pair
- Web Push notifications

**Student Engagement**
- Attendance streaks + milestone badges
- School-wide leaderboard
- QR code student ID for fast check-in

---

## Business Impact

| Metric | Before | After | Saving |
|---|---|---|---|
| Weekly allocation time | 4–6 hrs | ~10 min | ~5.5 hrs/week |
| Attendance compilation | 3–4 hrs | Real-time, 0 hrs | ~3.5 hrs/week |
| Weekly report generation | 2+ hrs | 1 click (~30 sec) | ~2 hrs/week |
| Data errors (paper → digital) | Frequent | Near-zero | — |
| **Total admin hours saved** | — | — | **~11 hrs/week** |

At a conservative $15/hr for admin time: **~$8,580/year saved** in labor alone — before accounting for reduced errors, faster decisions, and leadership visibility.

---

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Row-Level Security + Edge Functions)
- **Auth:** Supabase Auth (email/password, role-based access)
- **AI:** Claude (Anthropic) for weekly summary generation
- **Export:** SheetJS (XLSX) for multi-sheet Excel reports
- **Realtime:** Supabase Realtime subscriptions for live attendance and messages
- **Deployment:** Lovable (auto-deploy on `main`)

---

## Architecture

```
src/
├── pages/           # 35+ route components, one per role/feature
├── components/      # Shared UI + domain components (attendance, chat, kitchen, student)
├── integrations/
│   └── supabase/    # Generated types + typed client
├── lib/             # Export utilities, validation, theme engine
└── hooks/           # Realtime subscriptions, push notifications, streaks

supabase/
└── migrations/      # 37 versioned schema migrations
    # Key tables: profiles, activities, allocations, attendance_sessions,
    # attendance_records, meal_attendance, workout_attendance,
    # medical_visits, direct_messages, student_requests, badge_requests
```

**Security:** Every table protected by Row-Level Security policies. Role checks use a `has_role()` Postgres function — no trust in client-side role claims.

---

## Live Demo

**URL:** https://co-curricular.lovable.app

**Test accounts** (contact team for credentials):
- Admin view — full operations dashboard
- Teacher view — attendance submission + QR scan flow
- Student view — dashboard, preferences, QR ID card

---

## Video Walkthrough

*2-minute demo covering:*
1. Student submitting activity preferences
2. Admin running smart allocation
3. Teacher submitting attendance via QR scan
4. Admin generating AI weekly summary in one click
5. Excel export with 5-sheet report

---

## Setup

```bash
git clone https://github.com/ivanluckz/co-curricular.git
cd co-curricular
npm install
npm run dev
```

Requires a `.env` with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Team

| Name | Role |
|---|---|
| Ivan Lucky | Full-stack development, system architecture |
| Jes Washington | Product, operations design, testing |

---

## Repository

https://github.com/ivanluckz/co-curricular
