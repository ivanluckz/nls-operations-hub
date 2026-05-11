-- Final SQL Commands to Fix Attendance Issue (Handles Duplicates)

-- 1. Check current state
SELECT '=== Current Activities ===' as info;
SELECT id, title, days_of_week FROM activities WHERE is_active = true LIMIT 10;

SELECT '=== Current Allocations Count ===' as info;
SELECT COUNT(*) as allocation_count FROM allocations;

-- 2. Update existing allocations (only update, no inserts)
UPDATE allocations al
SET day_of_week = (
  SELECT days_of_week[1] 
  FROM activities a 
  WHERE a.id = al.activity_id
  AND days_of_week IS NOT NULL
  AND ARRAY_LENGTH(days_of_week, 1) > 0
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM activities a 
  WHERE a.id = al.activity_id 
  AND a.days_of_week IS NOT NULL
  AND ARRAY_LENGTH(a.days_of_week, 1) > 0
);

-- 3. Ensure all allocations have slot_number
UPDATE allocations 
SET slot_number = 1 
WHERE slot_number IS NULL;

-- 4. Create sample data ONLY for students with NO allocations at all
INSERT INTO allocations (student_id, activity_id, day_of_week, slot_number, status, preference_rank)
SELECT 
  p.id,
  a.id,
  CASE 
    WHEN ARRAY_LENGTH(a.days_of_week, 1) > 0 THEN a.days_of_week[1]
    ELSE 'Wednesday'
  END,
  1,
  'allocated',
  1
FROM activities a
CROSS JOIN profiles p
WHERE p.role = 'student'
AND a.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM allocations al WHERE al.student_id = p.id
)
LIMIT 20; -- Only create 20 new allocations to avoid conflicts

-- 5. Verify the fix
SELECT '=== Updated Allocations (Sample) ===' as info;
SELECT 
  a.title as activity_title,
  al.day_of_week,
  al.slot_number,
  p.full_name as student_name,
  p.email as student_email
FROM allocations al
JOIN activities a ON a.id = al.activity_id  
JOIN profiles p ON p.id = al.student_id
ORDER BY a.title, al.day_of_week
LIMIT 20;
