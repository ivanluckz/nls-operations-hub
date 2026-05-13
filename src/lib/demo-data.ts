// All pre-baked mock data for demo mode

export const DEMO_PROFILES = [
  { id: "demo-admin-001",   full_name: "Alex Nkurunziza",  email: "admin@nls-demo.com",         role: "admin",     avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-mod-001",     full_name: "Moderator Grace",  email: "mod@nls-demo.com",           role: "moderator", avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-teacher-001", full_name: "Mr. James Osei",   email: "james.osei@nls-demo.com",    role: "teacher",   avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-teacher-002", full_name: "Ms. Sarah Kamau",  email: "sarah.kamau@nls-demo.com",   role: "teacher",   avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-teacher-003", full_name: "Mr. David Nziza",  email: "david.nziza@nls-demo.com",   role: "teacher",   avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-rlcoach-001", full_name: "Coach Patrick",    email: "coach@nls-demo.com",         role: "rl_coach",  avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-medical-001", full_name: "Nurse Christine",  email: "nurse@nls-demo.com",         role: "medical",   avatar_url: null, student_class: null, house_id: null, banned: false },
  { id: "demo-student-001", full_name: "Alice Mukamana",   email: "alice@nls-demo.com",         role: "student",   avatar_url: null, student_class: "S3A", house_id: "house-001", banned: false },
  { id: "demo-student-002", full_name: "Bob Nkurunziza",   email: "bob@nls-demo.com",           role: "student",   avatar_url: null, student_class: "S3B", house_id: "house-002", banned: false },
  { id: "demo-student-003", full_name: "Clara Isingizwe",  email: "clara@nls-demo.com",         role: "student",   avatar_url: null, student_class: "S3A", house_id: "house-001", banned: false },
  { id: "demo-student-004", full_name: "David Habimana",   email: "david.h@nls-demo.com",       role: "student",   avatar_url: null, student_class: "S4A", house_id: "house-003", banned: false },
  { id: "demo-student-005", full_name: "Eva Ingabire",     email: "eva@nls-demo.com",           role: "student",   avatar_url: null, student_class: "S4B", house_id: "house-002", banned: false },
  { id: "demo-student-006", full_name: "Frank Nsengimana", email: "frank@nls-demo.com",         role: "student",   avatar_url: null, student_class: "S3B", house_id: "house-001", banned: false },
  { id: "demo-student-007", full_name: "Grace Uwase",      email: "grace@nls-demo.com",         role: "student",   avatar_url: null, student_class: "S3A", house_id: "house-003", banned: false },
  { id: "demo-student-008", full_name: "Henry Mugisha",    email: "henry@nls-demo.com",         role: "student",   avatar_url: null, student_class: "S4A", house_id: "house-002", banned: false },
  { id: "demo-student-009", full_name: "Irene Bizimana",   email: "irene@nls-demo.com",         role: "student",   avatar_url: null, student_class: "S3B", house_id: "house-001", banned: false },
  { id: "demo-student-010", full_name: "John Karangwa",    email: "john@nls-demo.com",          role: "student",   avatar_url: null, student_class: "S4B", house_id: "house-003", banned: false },
  { id: "demo-student-011", full_name: "Kate Ndayisaba",   email: "kate@nls-demo.com",          role: "student",   avatar_url: null, student_class: "S3A", house_id: "house-002", banned: false },
  { id: "demo-student-012", full_name: "Leo Tuyisenge",    email: "leo@nls-demo.com",           role: "student",   avatar_url: null, student_class: "S4A", house_id: "house-001", banned: false },
  { id: "demo-student-013", full_name: "Mary Gasana",      email: "mary@nls-demo.com",          role: "student",   avatar_url: null, student_class: "S3B", house_id: "house-003", banned: false },
  { id: "demo-student-014", full_name: "Nathan Kabera",    email: "nathan@nls-demo.com",        role: "student",   avatar_url: null, student_class: "S4B", house_id: "house-002", banned: false },
  { id: "demo-student-015", full_name: "Olivia Uwimana",   email: "olivia@nls-demo.com",        role: "student",   avatar_url: null, student_class: "S4A", house_id: "house-001", banned: false },
];

export const DEMO_USER_ROLES = [
  { user_id: "demo-admin-001",   role: "admin" },
  { user_id: "demo-mod-001",     role: "moderator" },
  { user_id: "demo-teacher-001", role: "teacher" },
  { user_id: "demo-teacher-002", role: "teacher" },
  { user_id: "demo-teacher-003", role: "teacher" },
  { user_id: "demo-rlcoach-001", role: "rl_coach" },
  { user_id: "demo-medical-001", role: "medical" },
  ...Array.from({ length: 15 }, (_, i) => ({ user_id: `demo-student-0${String(i + 1).padStart(2, "0")}`, role: "student" })),
];

export const DEMO_ACTIVITIES = [
  { id: "act-001", title: "Football",       category: "Sports",       capacity: 25, current_enrollment: 18, days_of_week: ["Monday","Wednesday","Friday"], teacher_id: "demo-teacher-001", teacher_in_charge: "james.osei@nls-demo.com", is_active: true, description: "Competitive football training and matches." },
  { id: "act-002", title: "Basketball",     category: "Sports",       capacity: 20, current_enrollment: 14, days_of_week: ["Tuesday","Thursday"],          teacher_id: "demo-teacher-002", teacher_in_charge: "sarah.kamau@nls-demo.com", is_active: true, description: "Basketball drills and inter-house tournaments." },
  { id: "act-003", title: "Drama & Theatre",category: "Arts",         capacity: 30, current_enrollment: 22, days_of_week: ["Monday","Thursday"],            teacher_id: "demo-teacher-003", teacher_in_charge: "david.nziza@nls-demo.com",  is_active: true, description: "Script reading, improvisation, and stage performance." },
  { id: "act-004", title: "Chess Club",     category: "Academics",    capacity: 20, current_enrollment: 11, days_of_week: ["Wednesday","Friday"],           teacher_id: "demo-teacher-002", teacher_in_charge: "sarah.kamau@nls-demo.com", is_active: true, description: "Strategy training and inter-school chess competitions." },
  { id: "act-005", title: "Swimming",       category: "Sports",       capacity: 15, current_enrollment: 9,  days_of_week: ["Tuesday","Thursday","Saturday"],teacher_id: "demo-teacher-001", teacher_in_charge: "james.osei@nls-demo.com", is_active: true, description: "Technique coaching and competitive swim meets." },
];

const STUDENT_IDS = Array.from({ length: 15 }, (_, i) => `demo-student-0${String(i + 1).padStart(2, "0")}`);
const ACTIVITY_MAP: Record<string, string> = {
  "demo-student-001": "act-001", "demo-student-002": "act-003", "demo-student-003": "act-002",
  "demo-student-004": "act-001", "demo-student-005": "act-004", "demo-student-006": "act-005",
  "demo-student-007": "act-003", "demo-student-008": "act-001", "demo-student-009": "act-002",
  "demo-student-010": "act-004", "demo-student-011": "act-005", "demo-student-012": "act-003",
  "demo-student-013": "act-001", "demo-student-014": "act-002", "demo-student-015": "act-004",
};

export const DEMO_ALLOCATIONS = STUDENT_IDS.map((sid) => {
  const actId = ACTIVITY_MAP[sid];
  const act = DEMO_ACTIVITIES.find((a) => a.id === actId)!;
  return {
    id: `alloc-${sid}`,
    student_id: sid,
    activity_id: actId,
    day_of_week: act.days_of_week[0],
    slot_number: 1,
    activities: act,
  };
});

export const DEMO_PREFERENCES = STUDENT_IDS.map((sid, i) => ({
  id: `pref-${sid}`,
  student_id: sid,
  activity_id: ACTIVITY_MAP[sid],
  rank: 1,
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
}));

const now = new Date();
const fmtDate = (d: Date) => d.toISOString().split("T")[0];
const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
const twoDaysAgo = new Date(now); twoDaysAgo.setDate(now.getDate() - 2);

export const DEMO_SESSIONS = [
  { id: "sess-001", activity_id: "act-001", date: fmtDate(now),       status: "draft",     created_by: "demo-teacher-001", notes: "" },
  { id: "sess-002", activity_id: "act-001", date: fmtDate(yesterday), status: "finalized", created_by: "demo-teacher-001", notes: "" },
  { id: "sess-003", activity_id: "act-002", date: fmtDate(yesterday), status: "finalized", created_by: "demo-teacher-002", notes: "" },
  { id: "sess-004", activity_id: "act-003", date: fmtDate(twoDaysAgo),status: "finalized", created_by: "demo-teacher-003", notes: "" },
  { id: "sess-005", activity_id: "act-005", date: fmtDate(twoDaysAgo),status: "submitted", created_by: "demo-rlcoach-001", notes: "" },
];

const footballStudents = ["demo-student-001","demo-student-004","demo-student-008","demo-student-013"];
const STATUS_CYCLE = ["present","present","present","absent","present","late","present","present","excused","present"];

export const DEMO_ATTENDANCE_RECORDS = DEMO_SESSIONS.flatMap((sess) => {
  const students = sess.activity_id === "act-001" ? footballStudents : ["demo-student-002","demo-student-003","demo-student-005"];
  return students.map((sid, i) => ({
    id: `rec-${sess.id}-${sid}`,
    session_id: sess.id,
    student_id: sid,
    status: STATUS_CYCLE[i % STATUS_CYCLE.length],
    marked_by: sess.created_by,
    created_at: sess.date + "T10:00:00Z",
  }));
});

export const DEMO_ATTENDANCE_STREAKS = STUDENT_IDS.map((sid, i) => ({
  student_id: sid,
  streak_type: "co_curricular",
  current_streak: Math.max(0, 12 - i * 1),
  longest_streak: Math.max(5, 20 - i),
}));

export const DEMO_STREAK_MILESTONES = [
  { student_id: "demo-student-001", milestone_type: "10_streak",  streak_type: "co_curricular", achieved_at: yesterday.toISOString() },
  { student_id: "demo-student-001", milestone_type: "5_streak",   streak_type: "co_curricular", achieved_at: twoDaysAgo.toISOString() },
  { student_id: "demo-student-004", milestone_type: "5_streak",   streak_type: "co_curricular", achieved_at: yesterday.toISOString() },
];

export const DEMO_MEDICAL_VISITS = [
  { id: "med-001", student_id: "demo-student-002", visited_at: yesterday.toISOString(), reason: "Headache", notes: "Paracetamol given, sent back to class", cleared_for_activity: true,  recorded_by: "demo-medical-001" },
  { id: "med-002", student_id: "demo-student-006", visited_at: yesterday.toISOString(), reason: "Knee pain", notes: "Ice pack applied, restricted from sport for 3 days", cleared_for_activity: false, recorded_by: "demo-medical-001" },
  { id: "med-003", student_id: "demo-student-010", visited_at: twoDaysAgo.toISOString(), reason: "Stomach ache", notes: "Rested 1 hour, recovered", cleared_for_activity: true, recorded_by: "demo-medical-001" },
];

export const DEMO_WORKOUT_CLEARANCES = [
  { id: "wc-001", student_id: "demo-student-006", cleared: false, notes: "Knee injury — no sport until May 16", cleared_by: "demo-medical-001", created_at: yesterday.toISOString() },
];

export const DEMO_MEAL_ATTENDANCE = Array.from({ length: 40 }, (_, i) => ({
  id: `meal-${i}`,
  student_id: STUDENT_IDS[i % STUDENT_IDS.length],
  meal_type: i % 3 === 0 ? "breakfast" : i % 3 === 1 ? "lunch" : "dinner",
  date: fmtDate(i < 20 ? now : yesterday),
  recorded_by: "demo-medical-001",
  created_at: now.toISOString(),
}));

export const DEMO_WORKOUT_ATTENDANCE = Array.from({ length: 12 }, (_, i) => ({
  id: `wa-${i}`,
  student_id: STUDENT_IDS[i % STUDENT_IDS.length],
  session_id: "sess-005",
  status: i % 5 === 0 ? "absent" : "present",
  recorded_by: "demo-rlcoach-001",
  created_at: twoDaysAgo.toISOString(),
}));

export const DEMO_MESSAGES = [
  { id: "msg-001", sender_id: "demo-teacher-001", activity_id: "act-001", content: "Great session today! Remember to bring your boots on Friday.", created_at: yesterday.toISOString() },
  { id: "msg-002", sender_id: "demo-mod-001",     activity_id: "act-003", content: "The Drama showcase has been moved to May 20th. Please inform your students.", created_at: twoDaysAgo.toISOString() },
];

export const DEMO_DIRECT_MESSAGES = [
  { id: "dm-001", sender_id: "demo-teacher-001", receiver_id: "demo-student-001", content: "Alice, well done at training today!", created_at: yesterday.toISOString(), read: false },
  { id: "dm-002", sender_id: "demo-mod-001",     receiver_id: "demo-admin-001",   content: "Allocations for Term 2 are ready for review.", created_at: twoDaysAgo.toISOString(), read: true },
];

export const DEMO_WEEKLY_SUMMARY = {
  summary: "This week saw strong overall attendance across co-curricular activities. Football had its best turnout of the term (89% present). Drama & Theatre had one excused absence due to a medical appointment. Chess Club noted a slight dip — 2 students were absent without prior notice. Recommend following up with Frank Nsengimana and Nathan Kabera. No serious concerns. Student engagement remains high with 4 active streak milestones achieved this week.",
  statistics: { totalIssues: 4, absent: 3, late: 1, excused: 2 },
  dateRange: { start: fmtDate(twoDaysAgo), end: fmtDate(now) },
  repeatOffenders: [
    { name: "Frank Nsengimana", count: 2 },
    { name: "Nathan Kabera",    count: 2 },
  ],
  problematicActivities: [
    { name: "Chess Club", count: 2 },
  ],
};

// Index helper
export const DEMO_TABLE_DATA: Record<string, unknown[]> = {
  profiles:             DEMO_PROFILES,
  user_roles:           DEMO_USER_ROLES,
  activities:           DEMO_ACTIVITIES,
  allocations:          DEMO_ALLOCATIONS,
  preferences:          DEMO_PREFERENCES,
  attendance_sessions:  DEMO_SESSIONS,
  attendance_records:   DEMO_ATTENDANCE_RECORDS,
  attendance_streaks:   DEMO_ATTENDANCE_STREAKS,
  streak_milestones:    DEMO_STREAK_MILESTONES,
  medical_visits:       DEMO_MEDICAL_VISITS,
  workout_clearances:   DEMO_WORKOUT_CLEARANCES,
  workout_attendance:   DEMO_WORKOUT_ATTENDANCE,
  meal_attendance:      DEMO_MEAL_ATTENDANCE,
  activity_messages:    DEMO_MESSAGES,
  direct_messages:      DEMO_DIRECT_MESSAGES,
};
