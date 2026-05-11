// Simple script to fix attendance data using Node.js and Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbjoqsaeulvwxlnbevog.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iam9xc2FldWx2d3hsbmJldm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTE3NzE2NSwiZXhwIjoyMDc0NzUzMTY1fQ.pBkSsY9yJqKJCsZ5jR9I2kL5XgHw3n7vF8qK2mWl7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixAttendance() {
  console.log("Starting attendance fix...");
  
  try {
    // Step 1: Check current data
    console.log("Checking current activities...");
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, title, days_of_week, day_of_week')
      .eq('is_active', true);
    
    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return;
    }
    
    console.log('Found activities:', activities.length);
    activities.forEach(a => {
      console.log(`- ${a.title}: days_of_week=${JSON.stringify(a.days_of_week)}, day_of_week=${a.day_of_week}`);
    });
    
    // Step 2: Update allocations day_of_week to match activities
    console.log("Updating allocations...");
    for (const activity of activities) {
      const correctDay = activity.days_of_week && activity.days_of_week.length > 0 
        ? activity.days_of_week[0] 
        : activity.day_of_week || 'Wednesday';
      
      const { error: updateError } = await supabase
        .from('allocations')
        .update({ day_of_week: correctDay })
        .eq('activity_id', activity.id);
      
      if (updateError) {
        console.error(`Error updating allocations for ${activity.title}:`, updateError);
      } else {
        console.log(`Updated allocations for ${activity.title} to day: ${correctDay}`);
      }
    }
    
    // Step 3: Ensure all allocations have slot_number
    console.log("Setting slot_number to 1 where null...");
    const { error: slotError } = await supabase
      .from('allocations')
      .update({ slot_number: 1 })
      .is('slot_number', null);
    
    if (slotError) {
      console.error('Error updating slot numbers:', slotError);
    } else {
      console.log('Updated slot numbers');
    }
    
    // Step 4: Check if we have any allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from('allocations')
      .select(`
        id,
        activity_id,
        day_of_week,
        slot_number,
        student_id,
        activities (title),
        profiles (full_name)
      `)
      .limit(10);
    
    if (allocationsError) {
      console.error('Error fetching allocations:', allocationsError);
    } else {
      console.log(`Found ${allocations.length} allocations:`);
      allocations.forEach(al => {
        console.log(`- ${al.activities?.title}: ${al.profiles?.full_name} (${al.day_of_week}, slot ${al.slot_number})`);
      });
    }
    
    // Step 5: If no allocations, create some sample data
    if (!allocations || allocations.length === 0) {
      console.log("No allocations found, creating sample data...");
      
      // Get students
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        .limit(10);
      
      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return;
      }
      
      // Create allocations for each student to first activity
      if (activities.length > 0 && students.length > 0) {
        const firstActivity = activities[0];
        const correctDay = firstActivity.days_of_week && firstActivity.days_of_week.length > 0 
          ? firstActivity.days_of_week[0] 
          : firstActivity.day_of_week || 'Wednesday';
        
        for (const student of students) {
          const { error: insertError } = await supabase
            .from('allocations')
            .insert({
              student_id: student.id,
              activity_id: firstActivity.id,
              day_of_week: correctDay,
              slot_number: 1,
              status: 'allocated',
              preference_rank: 1
            });
          
          if (insertError) {
            console.error(`Error creating allocation for ${student.full_name}:`, insertError);
          } else {
            console.log(`Created allocation for ${student.full_name} to ${firstActivity.title}`);
          }
        }
      }
    }
    
    console.log("Attendance fix completed!");
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixAttendance();
