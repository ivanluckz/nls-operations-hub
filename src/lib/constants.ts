// Centralized constants to eliminate magic strings throughout the codebase

export const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  TEACHER: 'teacher',
  STUDENT: 'student',
  KITCHEN_STAFF: 'kitchen_staff',
  RL_COACH: 'rl_coach',
  MEDICAL: 'medical'
} as const;

export const STUDENT_CLASSES = [
  '7A', '7B', '7C', '7D', '7E',
  '8A', '8B', '8C', '8D', '8E', '8F',
] as const;
export type StudentClass = typeof STUDENT_CLASSES[number];

export const WORKOUT_LOCATIONS = ['Courts', 'Pitch', 'Competition'] as const;
export type WorkoutLocation = typeof WORKOUT_LOCATIONS[number];

export const HOUSES = [
  'Amistad', 'Altruismo', 'Sollevare', 'Nukumori',
  'Protos', 'Onraka', 'Reveur', 'Isibindi'
] as const;
export type HouseName = typeof HOUSES[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
export type MealType = typeof MEAL_TYPES[number];

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  EXCUSED: 'excused'
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

export const SESSION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  FINALIZED: 'finalized'
} as const;

export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const QUERY_LIMITS = {
  DEFAULT: 1000,
  MAX: 5000,
  ACTIVITIES: 500,
  STUDENTS: 1000,
  NOTIFICATIONS: 500
} as const;

export const IMAGE_LIMITS = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_DIMENSION: 1024
} as const;

export const CHATBOT_LIMITS = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_CONVERSATION_LENGTH: 50
} as const;

export const QR_SCAN_COOLDOWN_MS = 500;

export const SCAN_MODE = {
  SINGLE: 'single',
  CONTINUOUS: 'continuous',
} as const;

export type ScanMode = typeof SCAN_MODE[keyof typeof SCAN_MODE];

// Auto-late detection: grace period in minutes after activity start
export const LATE_GRACE_PERIOD_MINUTES = 5;
// After this many minutes, auto-mark as absent (can be overridden)
export const ABSENT_THRESHOLD_MINUTES = 15;

export const DATE_RANGE_LIMITS = {
  MAX_DAYS_PAST: 30,
  MAX_DAYS_FUTURE: 30
} as const;
