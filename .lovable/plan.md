

# Academic System Customization Plan

This is a big scope covering all four areas. I'll break it into focused, impactful improvements for each.

---

## 1. Timetable Builder UI Improvements (Admin)

**Current state**: Basic HTML table with click-to-edit dialog. Functional but plain.

**Changes**:
- Add a **"Copy slot"** feature: right-click or hold a slot to copy it, then click an empty cell to paste (same subject/teacher/room)
- Add a **"Clear all"** button with confirmation to reset a class's entire timetable
- Add **conflict warnings** inline — highlight cells red if a teacher is double-booked across classes
- Add **slot count summary** below the grid showing how many periods each subject has per week
- Improve cell rendering with better color fills (full background with opacity instead of just left border)

## 2. Student Timetable View

**Current state**: Full timetable grid + upcoming classes + subjects + attendance tabs. Already quite good.

**Changes**:
- Add a **"Today" view** as the default tab — shows only today's schedule as a vertical timeline with current period highlighted
- Add a **countdown timer** to next class ("Math starts in 23 min")
- Show **attendance percentage badge** per subject in the Subjects tab (color-coded: green >90%, amber >75%, red <75%)
- Add **"No class right now"** or **"In: Period 3 — Math"** live status in the header stats bar

## 3. Attendance Marking Flow (Teacher)

**Current state**: Select today's class from dropdown → mark each student individually. Basic but works.

**Changes**:
- Add **"Mark All Present"** and **"Mark All Absent"** bulk buttons at the top of the student list
- Add **quick-tap toggle**: single tap cycles through present → absent → late → excused instead of showing 4 buttons per row (saves space on mobile)
- Add **attendance summary bar** showing counts (12 present, 2 absent, 1 late) that updates live as you mark
- Add **past date picker** so teachers can mark attendance for previous days, not just today
- Show a **"Session already finalized"** warning more prominently with option to reopen (admin only)

## 4. Subjects & Classes Management (Admin)

**Current state**: Simple CRUD table for subjects, card-based class list with member badges.

**Changes**:
- **Subjects page**: Add a usage column showing how many timetable slots use each subject. Add a search/filter bar. Add bulk color presets (material design palette).
- **Classes page**: Show member count on each class card. Add **"Bulk add by year level"** — auto-add all students from profiles matching a year pattern. Add CSV export of class roster.

---

## Technical Approach

- All changes are frontend-only (existing DB schema supports everything)
- No new tables or migrations needed
- Edit existing page files directly rather than creating new components (keep it contained)
- Use existing UI components (Badge, Button, Select, etc.)

## Implementation Order

1. Timetable Builder improvements
2. Teacher attendance flow
3. Student timetable "Today" view
4. Subjects & classes management polish

