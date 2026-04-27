/**
 * Co-curricular activity data export to Excel/CSV
 */

import * as XLSX from 'xlsx';

export interface ActivityExportRow {
  id: string;
  title: string;
  category: string;
  teacher_in_charge: string;
  capacity: number;
  uniqueStudentCount: number;
  days_of_week: string[];
  students: Array<{
    student_id: string;
    student_name: string;
    student_email: string;
    day_of_week: string;
    slot_number: number;
  }>;
}

export function exportActivitiesToExcel(activities: ActivityExportRow[]) {
  const workbook = XLSX.utils.book_new();

  // Summary
  const totalActivities = activities.length;
  const totalEnrollment = activities.reduce((s, a) => s + a.uniqueStudentCount, 0);
  const totalCapacity = activities.reduce((s, a) => s + a.capacity, 0);
  const utilization = totalCapacity > 0 ? Math.round((totalEnrollment / totalCapacity) * 100) : 0;

  const summary: any[] = [
    ['NLS CO-CURRICULAR ACTIVITY REPORT'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['KEY METRICS'],
    ['Total Activities', totalActivities],
    ['Total Unique Enrollments', totalEnrollment],
    ['Total Capacity', totalCapacity],
    ['Overall Utilization %', utilization + '%'],
    [''],
    ['ENROLLMENT BY ACTIVITY'],
    ['Activity', 'Category', 'Teacher', 'Enrolled', 'Capacity', '% Full', 'Days'],
  ];

  const sorted = [...activities].sort((a, b) => a.title.localeCompare(b.title));
  sorted.forEach(a => {
    const pct = a.capacity > 0 ? Math.round((a.uniqueStudentCount / a.capacity) * 100) : 0;
    summary.push([
      a.title,
      a.category,
      a.teacher_in_charge,
      a.uniqueStudentCount,
      a.capacity,
      pct + '%',
      (a.days_of_week || []).join(', '),
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Roster
  const roster: any[] = [];
  sorted.forEach((a, idx) => {
    if (idx > 0) roster.push([]);
    const pct = a.capacity > 0 ? Math.round((a.uniqueStudentCount / a.capacity) * 100) : 0;
    roster.push([`${a.title} — ${a.category} (${a.uniqueStudentCount}/${a.capacity} • ${pct}% full)`]);
    roster.push(['Teacher:', a.teacher_in_charge]);
    roster.push(['Student Name', 'Email', 'Day', 'Slot']);

    const daySlots = new Map<string, Set<number>>();
    a.students.forEach(s => {
      if (!daySlots.has(s.day_of_week)) daySlots.set(s.day_of_week, new Set());
      daySlots.get(s.day_of_week)!.add(s.slot_number);
    });
    const multiSlot = new Set([...daySlots.entries()].filter(([, slots]) => slots.size > 1).map(([d]) => d));

    const students = [...a.students].sort((x, y) =>
      x.student_name.localeCompare(y.student_name) || x.slot_number - y.slot_number
    );

    if (students.length === 0) {
      roster.push(['No students enrolled', '', '', '']);
    } else {
      students.forEach(s => {
        roster.push([
          s.student_name,
          s.student_email,
          s.day_of_week,
          multiSlot.has(s.day_of_week) ? `Slot ${s.slot_number}` : '—',
        ]);
      });
    }
  });

  const rosterSheet = XLSX.utils.aoa_to_sheet(roster);
  rosterSheet['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, rosterSheet, 'Student Roster');

  // Utilization
  const util: any[] = [['Activity', 'Capacity', 'Enrolled', 'Available', '% Utilized', 'Status']];
  sorted
    .map(a => {
      const enrolled = a.uniqueStudentCount;
      const available = a.capacity - enrolled;
      const pct = a.capacity > 0 ? Math.round((enrolled / a.capacity) * 100) : 0;
      return { a, enrolled, available, pct };
    })
    .sort((x, y) => y.pct - x.pct)
    .forEach(item => {
      util.push([
        item.a.title,
        item.a.capacity,
        item.enrolled,
        item.available,
        item.pct + '%',
        item.enrolled >= item.a.capacity ? '🔴 FULL' : item.pct >= 80 ? '🟡 HIGH' : '🟢 AVAILABLE',
      ]);
    });

  const utilSheet = XLSX.utils.aoa_to_sheet(util);
  utilSheet['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, utilSheet, 'Utilization');

  XLSX.writeFile(workbook, `NLS_Activities_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportActivitiesAsCSV(activities: ActivityExportRow[]) {
  const lines = ['Activity,Category,Teacher,Enrolled,Capacity,% Full,Days'];
  [...activities]
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach(a => {
      const pct = a.capacity > 0 ? Math.round((a.uniqueStudentCount / a.capacity) * 100) : 0;
      lines.push(
        `"${a.title}","${a.category}","${a.teacher_in_charge}",${a.uniqueStudentCount},${a.capacity},${pct}%,"${(a.days_of_week || []).join(', ')}"`
      );
    });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `NLS_Activities_Summary_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
