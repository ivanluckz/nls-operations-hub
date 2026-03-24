

# Allow Teachers to Award Badges to Their Students

## Overview
Co-curricular teachers can award badges to students enrolled in their activities. This requires a database RLS policy change and UI updates to expose the badge-grant panel to teachers viewing their students.

## Database Changes

**New RLS policy on `user_badges`** — Allow teachers to INSERT badges for students in their activities:
```sql
CREATE POLICY "Teachers can award badges to their students"
ON public.user_badges FOR INSERT TO public
WITH CHECK (
  awarded_by = auth.uid()
  AND has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM allocations al
    JOIN activities a ON a.id = al.activity_id
    WHERE al.student_id = user_badges.user_id
      AND a.teacher_id = auth.uid()
  )
);
```

**New RLS policy for DELETE** (so teachers can also remove badges they granted):
```sql
CREATE POLICY "Teachers can remove badges they awarded"
ON public.user_badges FOR DELETE TO public
USING (
  awarded_by = auth.uid()
  AND has_role(auth.uid(), 'teacher')
);
```

## UI Changes

### 1. `UserProfileCard.tsx`
- Rename `isAdminViewing` prop to also accept a new `isTeacherViewing` prop (or generalize to `canGrantBadges`)
- Show the badge-grant panel when either admin or teacher is viewing a student profile
- Teachers only see the panel for students in their activities

### 2. `TeacherDashboard.tsx` — Student Roster
- Add a clickable student name/row that opens `UserProfileCard` for that student
- Pass `canGrantBadges={true}` so the badge panel appears
- Fetch badges for students and pass them to the card

### 3. `DirectMessages.tsx`
- Update the `isAdminViewing` logic: also pass `true` when the current user is a teacher viewing one of their students

## Files to Modify
- **Migration**: New RLS policies on `user_badges`
- `src/components/chat/UserProfileCard.tsx` — accept `canGrantBadges` prop alongside `isAdminViewing`
- `src/pages/TeacherDashboard.tsx` — add student profile card with badge granting
- `src/pages/DirectMessages.tsx` — enable badge panel for teachers viewing their students

