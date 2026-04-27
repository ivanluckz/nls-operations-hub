/**
 * Workout data export to Excel/Google Sheets format
 */

import * as XLSX from 'xlsx';

export interface WorkoutExportData {
  workouts: Array<{
    id: string;
    name: string;
    description: string;
    days_of_week: string[];
    capacity: number;
    is_active: boolean;
    created_at: string;
  }>;
  teachers: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
  workoutTeachers: Array<{
    workout_id: string;
    workout_name: string;
    teacher_id: string;
    teacher_name: string;
  }>;
  signups: Array<{
    id: string;
    workout_id: string;
    workout_name: string;
    student_id: string;
    student_name: string;
    student_email: string;
    created_at: string;
  }>;
  profiles: Record<string, { id: string; full_name: string; email: string }>;
}

export function exportWorkoutsToExcel(data: WorkoutExportData) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['Workout Management Report'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['Summary Statistics'],
    ['Total Workouts', data.workouts.length],
    ['Active Workouts', data.workouts.filter(w => w.is_active).length],
    ['Total Students Enrolled', data.signups.length],
    ['Total Teachers', data.teachers.length],
    [''],
    ['Enrollment by Workout'],
  ];

  // Add enrollment counts by workout
  data.workouts.forEach(w => {
    const count = data.signups.filter(s => s.workout_id === w.id).length;
    summaryData.push([w.name, count, `${w.capacity} capacity`, `${Math.round((count / w.capacity) * 100)}% full`]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: Workouts
  const workoutsData = [
    ['Workout Name', 'Description', 'Days of Week', 'Capacity', 'Status', 'Created Date'],
    ...data.workouts.map(w => [
      w.name,
      w.description,
      w.days_of_week.join(', '),
      w.capacity,
      w.is_active ? 'Active' : 'Inactive',
      new Date(w.created_at).toLocaleDateString()
    ])
  ];
  const workoutsSheet = XLSX.utils.aoa_to_sheet(workoutsData);
  workoutsSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, workoutsSheet, 'Workouts');

  // Sheet 3: Teachers & Assignments
  const teacherAssignmentsData = [
    ['Teacher Name', 'Email', 'Assigned Workouts', 'Count'],
    ...data.teachers.map(t => {
      const assigned = data.workoutTeachers
        .filter(wt => wt.teacher_id === t.id)
        .map(wt => wt.workout_name)
        .join('; ');
      return [t.full_name, t.email, assigned, assigned ? assigned.split(';').length : 0];
    })
  ];
  const teacherSheet = XLSX.utils.aoa_to_sheet(teacherAssignmentsData);
  teacherSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(workbook, teacherSheet, 'Teachers');

  // Sheet 4: Enrollments
  const enrollmentsData = [
    ['Workout', 'Student Name', 'Email', 'Enrollment Date'],
    ...data.signups.map(s => [
      s.workout_name,
      s.student_name,
      s.student_email,
      new Date(s.created_at).toLocaleDateString()
    ])
  ];
  const enrollmentsSheet = XLSX.utils.aoa_to_sheet(enrollmentsData);
  enrollmentsSheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, enrollmentsSheet, 'Enrollments');

  // Sheet 5: Detailed Enrollment by Workout
  const detailedData: any[][] = [];
  data.workouts.forEach(w => {
    detailedData.push([w.name, `Capacity: ${w.capacity}`, `Status: ${w.is_active ? 'Active' : 'Inactive'}`]);
    detailedData.push(['Student Name', 'Email', 'Enrollment Date']);

    const studentsInWorkout = data.signups.filter(s => s.workout_id === w.id);
    if (studentsInWorkout.length === 0) {
      detailedData.push(['No enrollments', '', '']);
    } else {
      studentsInWorkout.forEach(s => {
        detailedData.push([s.student_name, s.student_email, new Date(s.created_at).toLocaleDateString()]);
      });
    }
    detailedData.push(['']);
  });

  const detailedSheet = XLSX.utils.aoa_to_sheet(detailedData);
  detailedSheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed Enrollments');

  // Write file
  const filename = `NLS_Workouts_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Alternative: Export as CSV for direct Google Sheets import
 */
export function exportWorkoutsAsCSV(data: WorkoutExportData) {
  const csvData = [
    'Workout,Status,Capacity,Days,Enrolled,% Full,Teachers',
    ...data.workouts.map(w => {
      const signupCount = data.signups.filter(s => s.workout_id === w.id).length;
      const fillPercent = Math.round((signupCount / w.capacity) * 100);
      const teachers = data.workoutTeachers
        .filter(wt => wt.workout_id === w.id)
        .map(wt => wt.teacher_name)
        .join('; ');

      return `"${w.name}","${w.is_active ? 'Active' : 'Inactive'}",${w.capacity},"${w.days_of_week.join(', ')}",${signupCount},${fillPercent}%,"${teachers}"`;
    })
  ].join('\n');

  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `NLS_Workouts_Summary_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
