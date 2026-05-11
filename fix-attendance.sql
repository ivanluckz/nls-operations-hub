-- Fix attendance data migration script
-- This script fixes the mismatch between activities.days_of_week (array) and allocations.day_of_week (text)

-- First, let's see what we're working with
SELECT 'Current activities with days_of_week:' as info;
SELECT id, title, days_of_week, day_of_week FROM activities;

-- Update allocations to match activities structure
-- For each activity, ensure allocations have the correct day_of_week and slot_number

-- Step 1: Update allocations for activities that have days_of_week as array
UPDATE allocations al
SET day_of_week = (
  SELECT UNNEST(days_of_week)[1] 
  FROM activities a 
  WHERE a.id = al.activity_id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM activities a 
  WHERE a.id = al.activity_id 
  AND a.days_of_week IS NOT NULL
  AND ARRAY_LENGTH(a.days_of_week, 1) > 0
);

-- Step 2: Ensure all allocations have a slot_number (default to 1 if null)
UPDATE allocations 
SET slot_number = 1 
WHERE slot_number IS NULL;

-- Step 3: Create sample allocations if none exist for testing
INSERT INTO allocations (student_id, activity_id, day_of_week, slot_number, status, preference_rank)
SELECT 
  p.id as student_id,
  a.id as activity_id,
  CASE 
    WHEN ARRAY_LENGTH(a.days_of_week, 1) > 0 THEN a.days_of_week[1]
    ELSE 'Wednesday'
  END as day_of_week,
  1 as slot_number,
  'allocated' as status,
  1 as preference_rank
FROM activities a
CROSS JOIN profiles p
WHERE p.role = 'student'::user_role
AND a.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM allocations al 
  WHERE al.activity_id = a.id 
  AND al.student_id = p.id
  AND al.day_of_week = CASE 
    WHEN ARRAY_LENGTH(a.days_of_week, 1) > 0 THEN a.days_of_week[1]
    ELSE 'Wednesday'
  END
  AND al.slot_number = 1
)
LIMIT 50; -- Create some sample allocations for testing

-- Step 4: Verify the fix
SELECT 'Updated allocations:' as info;
SELECT al.id, a.title as activity_title, al.day_of_week, al.slot_number, p.full_name as student_name
FROM allocations al
JOIN activities a ON a.id = al.activity_id  
JOIN profiles p ON p.id = al.student_id
ORDER BY a.title, al.day_of_week, al.slot_number
LIMIT 20;
