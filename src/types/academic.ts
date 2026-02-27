// TypeScript interfaces for the academic timetable & attendance system
// TODO: regenerate Supabase types after running migration 20260227290000_academic_system.sql

export interface AcademicPeriod {
  id: string;
  period_number: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
}

export interface AcademicSubject {
  id: string;
  name: string;
  code: string | null;
  color: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  year_level: string | null;
}

export interface ClassGroupMember {
  id: string;
  class_group_id: string;
  student_id: string;
  enrolled_at: string;
}

export interface TimetableSlot {
  id: string;
  subject_id: string;
  teacher_id: string;
  class_group_id: string | null;
  day_of_week: string;
  period_number: number;
  room: string | null;
  is_elective: boolean;
  created_at: string;
  // Joined fields
  academic_subjects?: AcademicSubject;
  class_groups?: ClassGroup;
  teacher_profile?: { full_name: string; email: string };
}

export interface TimetableEnrollment {
  id: string;
  slot_id: string;
  student_id: string;
  enrolled_at: string;
}

export interface AcademicSession {
  id: string;
  slot_id: string;
  session_date: string;
  teacher_id: string;
  status: 'open' | 'finalized';
  created_at: string;
  finalized_at: string | null;
  // Joined
  timetable_slots?: TimetableSlot;
}

export interface AcademicAttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  marked_at: string | null;
  marked_by: string | null;
}

export const ACADEMIC_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type AcademicDay = typeof ACADEMIC_DAYS[number];

/** Returns white or black text color based on background hex luminance */
export function textColorForBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? '#000000' : '#ffffff';
}
