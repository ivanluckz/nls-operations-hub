

# Admin AI + Student Request System

## Overview

A two-sided system where students submit structured requests (activity swaps, excusals, etc.) through an AI-assisted chat, and admins process those requests via an "Admin AI" console — a lighter version of DevAI that surfaces pending requests and can auto-execute approved ones.

## Architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Student Chat    │────▶│  student_requests │◀────│   Admin AI      │
│  (AI-assisted)   │     │  table (DB)       │     │   Console       │
│  Drafts request  │     │  status: pending/ │     │  Reviews queue  │
│  → submits it    │     │  approved/denied  │     │  Approves →     │
└─────────────────┘     └──────────────────┘     │  auto-executes  │
                                                  └─────────────────┘
```

## What Gets Built

### 1. New Database Table: `student_requests`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| student_id | uuid | Who submitted |
| request_type | text | `swap_activity`, `excuse`, `drop_activity`, `other` |
| details | jsonb | Structured payload (activity IDs, dates, reasons) |
| reason | text | Student's written reason |
| status | text | `pending` → `approved` / `denied` |
| admin_notes | text | Admin's response |
| reviewed_by | uuid | Which admin processed it |
| reviewed_at | timestamptz | When |
| created_at | timestamptz | Default now() |

RLS: Students can INSERT (own) and SELECT (own). Admins/moderators can SELECT all + UPDATE.

Enable realtime so the Admin AI console gets live updates.

### 2. Student Request Flow (Hybrid: Chat + Form)

On the **Student Dashboard** "choose" screen, add a new card: **"Request Change"** — opens a new page `/student/request`.

The page has:
- A **request type selector** (swap activity, get excused, drop activity, other)
- Based on type, show relevant form fields:
  - **Swap**: current activity dropdown (from their allocations) → desired activity dropdown → day picker → reason
  - **Excuse**: activity dropdown → date picker → reason
  - **Drop**: activity dropdown → reason
  - **Other**: free-text description
- Submit creates a row in `student_requests` with status `pending`
- Student can see their past requests and statuses on the same page

No AI needed on the student side — keep it simple with structured forms. The AI processes it on the admin side.

### 3. Admin AI Console (`/admin/admin-ai`)

A new page that combines:

**A) Request Queue Panel** — shows all `pending` requests in a list/table with student name, type, reason, and timestamp. Each request has Approve / Deny buttons.

**B) Admin AI Chat** — similar to DevAI but scoped down:
- No nuclear actions (no `clear_all_allocations`, `clear_all_preferences`)
- System prompt includes the current pending requests as context
- When admin approves a request, Admin AI:
  - For **swap**: proposes a `move_student` action block, checks capacity
  - For **excuse**: proposes `excuse_attendance` or creates pre-excuse record
  - For **drop**: proposes `remove_allocation`
  - Admin confirms → action executes → request status updated to `approved`
- Admin can also deny with a note

**Key difference from DevAI**: Admin AI is request-driven. It surfaces pending requests and suggests actions. It does NOT have God Mode or storage/nuclear capabilities.

### 4. Edge Function: `process-student-request`

A new edge function that:
- Takes a request ID + action (approve/deny) + optional admin notes
- Validates admin role via JWT
- For approvals: executes the database change (swap allocation, create excuse, remove allocation)
- Updates the request status
- This keeps execution server-side rather than client-side for security

### 5. New Routes & Sidebar

| Route | Component | Access |
|-------|-----------|--------|
| `/student/request` | StudentRequests | student |
| `/admin/admin-ai` | AdminAI | admin |

- Add "Request Change" card to Student Dashboard choose screen
- Add "Admin AI" item to AdminSidebar with a pending request count badge

### 6. Notifications

When a request is approved/denied, the student sees it:
- On their `/student/request` page (status updates via realtime)
- Optionally a toast on dashboard load if they have a recently reviewed request

## Implementation Order

1. **Database migration** — Create `student_requests` table with RLS + enable realtime
2. **Student Request page** — Form-based submission at `/student/request`, list of past requests
3. **Edge function** — `process-student-request` for server-side approval execution
4. **Admin AI page** — Chat interface with request queue, lighter DevAI prompt, approve/deny flow
5. **Sidebar + routing** — Wire up routes, add sidebar link with badge count, add student dashboard card

## Files to Create
- `src/pages/StudentRequests.tsx` — student request form + history
- `src/pages/AdminAI.tsx` — admin AI console with request queue
- `supabase/functions/process-student-request/index.ts` — server-side request processing

## Files to Edit
- `src/App.tsx` — add 2 new routes
- `src/pages/StudentDashboard.tsx` — add "Request Change" card
- `src/components/admin/AdminSidebar.tsx` — add Admin AI link
- `src/pages/AdminDashboard.tsx` — add Admin AI quick action card
- `supabase/config.toml` — register new edge function

