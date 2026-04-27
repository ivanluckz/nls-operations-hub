/**
 * Workout data export to Excel/Google Sheets format
 * Professionally organized with formatting, sorting, and styling
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

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "1F2937" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true }
};

const titleStyle = {
  font: { bold: true, size: 16, color: { rgb: "1F2937" } }
};

const subtitleStyle = {
  font: { bold: true, size: 11, color: { rgb: "374151" } }
};

export function exportWorkoutsToExcel(data: WorkoutExportData) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const summaryRows: any[] = [];
  summaryRows.push(['NLS WORKOUT MANAGEMENT REPORT']);
  summaryRows.push(['Generated:', new Date().toLocaleString()]);
  summaryRows.push(['']);

  const totalWorkouts = data.workouts.length;
  const activeWorkouts = data.workouts.filter(w => w.is_active).length;
  const totalEnrollment = data.signups.length;
  const totalTeachers = data.teachers.length;
  const avgCapacity = totalWorkouts > 0
    ? Math.round(data.workouts.reduce((sum, w) => sum + w.capacity, 0) / totalWorkouts)
    : 0;

  summaryRows.push(['KEY METRICS']);
  summaryRows.push(['Total Workouts', totalWorkouts]);
  summaryRows.push(['Active Workouts', activeWorkouts]);
  summaryRows.push(['Total Enrollment', totalEnrollment]);
  summaryRows.push(['Total Teachers', totalTeachers]);
  summaryRows.push(['Avg Capacity per Workout', avgCapacity]);
  summaryRows.push(['Overall Utilization %', totalWorkouts > 0 ? Math.round((totalEnrollment / (totalWorkouts * avgCapacity)) * 100) + '%' : '0%']);
  summaryRows.push(['']);
  summaryRows.push(['ENROLLMENT BY WORKOUT']);
  summaryRows.push(['Workout Name', 'Teachers', 'Enrolled', 'Capacity', '% Full', 'Status']);

  const sortedWorkouts = [...data.workouts].sort((a, b) => a.name.localeCompare(b.name));
  sortedWorkouts.forEach(w => {
    const count = data.signups.filter(s => s.workout_id === w.id).length;
    const percent = Math.round((count / w.capacity) * 100);
    const teachers = data.workoutTeachers
      .filter(wt => wt.workout_id === w.id)
      .map(wt => wt.teacher_name)
      .join(', ') || '—';
    summaryRows.push([w.name, teachers, count, w.capacity, percent + '%', w.is_active ? '✓ Active' : '✗ Inactive']);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  summarySheet['!freeze'] = { xSplit: 0, ySplit: 11 };
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: Workouts Overview (sorted alphabetically)
  const workoutsData: any[] = [
    ['Workout Name', 'Description', 'Days of Week', 'Capacity', 'Enrolled', '% Full', 'Status', 'Created Date']
  ];

  sortedWorkouts.forEach(w => {
    const count = data.signups.filter(s => s.workout_id === w.id).length;
    const percent = Math.round((count / w.capacity) * 100);
    workoutsData.push([
      w.name,
      w.description || '—',
      w.days_of_week.join(', '),
      w.capacity,
      count,
      percent,
      w.is_active ? 'Active' : 'Inactive',
      new Date(w.created_at).toLocaleDateString()
    ]);
  });

  const workoutsSheet = XLSX.utils.aoa_to_sheet(workoutsData);
  workoutsSheet['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
  workoutsSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, workoutsSheet, 'Workouts');

  // Sheet 3: Student Roster (organized by workout)
  const rosterData: any[] = [];
  sortedWorkouts.forEach((w, idx) => {
    if (idx > 0) rosterData.push([]); // Blank row between workouts

    const count = data.signups.filter(s => s.workout_id === w.id).length;
    const percent = Math.round((count / w.capacity) * 100);
    rosterData.push([`${w.name} (${count}/${w.capacity} • ${percent}% full)`]);
    rosterData.push(['Student Name', 'Email', 'Enrollment Date']);

    const students = data.signups
      .filter(s => s.workout_id === w.id)
      .sort((a, b) => a.student_name.localeCompare(b.student_name));

    if (students.length === 0) {
      rosterData.push(['No students enrolled', '', '']);
    } else {
      students.forEach(s => {
        rosterData.push([
          s.student_name,
          s.student_email,
          new Date(s.created_at).toLocaleDateString()
        ]);
      });
    }
  });

  const rosterSheet = XLSX.utils.aoa_to_sheet(rosterData);
  rosterSheet['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, rosterSheet, 'Student Roster');

  // Sheet 4: Teacher Assignments
  const teacherData: any[] = [
    ['Teacher Name', 'Email', 'Workouts Assigned', 'Count']
  ];

  const sortedTeachers = [...data.teachers].sort((a, b) => a.full_name.localeCompare(b.full_name));
  sortedTeachers.forEach(t => {
    const assigned = data.workoutTeachers
      .filter(wt => wt.teacher_id === t.id)
      .map(wt => wt.workout_name)
      .sort()
      .join(', ') || '—';
    const count = assigned === '—' ? 0 : data.workoutTeachers.filter(wt => wt.teacher_id === t.id).length;
    teacherData.push([t.full_name, t.email, assigned, count]);
  });

  const teacherSheet = XLSX.utils.aoa_to_sheet(teacherData);
  teacherSheet['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 50 }, { wch: 8 }];
  teacherSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, teacherSheet, 'Teachers');

  // Sheet 5: Enrollment Utilization (sorted by % full descending)
  const utilizationData: any[] = [
    ['Workout Name', 'Capacity', 'Enrolled', 'Available', '% Utilized', 'Status']
  ];

  sortedWorkouts
    .map(w => {
      const count = data.signups.filter(s => s.workout_id === w.id).length;
      const available = w.capacity - count;
      const percent = Math.round((count / w.capacity) * 100);
      return { workout: w, count, available, percent };
    })
    .sort((a, b) => b.percent - a.percent)
    .forEach(item => {
      utilizationData.push([
        item.workout.name,
        item.workout.capacity,
        item.count,
        item.available,
        item.percent + '%',
        item.count >= item.workout.capacity ? '🔴 FULL' :
        item.percent >= 80 ? '🟡 HIGH' : '🟢 AVAILABLE'
      ]);
    });

  const utilizationSheet = XLSX.utils.aoa_to_sheet(utilizationData);
  utilizationSheet['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
  utilizationSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, utilizationSheet, 'Utilization');

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
