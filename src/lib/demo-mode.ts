export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const DEMO_USERS = [
  { role: "admin",     id: "demo-admin-001",    name: "Alex Nkurunziza",  email: "admin@nls-demo.com",     avatar: null },
  { role: "moderator", id: "demo-mod-001",      name: "Moderator Grace",  email: "mod@nls-demo.com",       avatar: null },
  { role: "teacher",   id: "demo-teacher-001",  name: "Mr. James Osei",   email: "james.osei@nls-demo.com",avatar: null },
  { role: "student",   id: "demo-student-001",  name: "Alice Mukamana",   email: "alice@nls-demo.com",     avatar: null },
  { role: "rl_coach",  id: "demo-rlcoach-001",  name: "Coach Patrick",    email: "coach@nls-demo.com",     avatar: null },
  { role: "medical",   id: "demo-medical-001",  name: "Nurse Christine",  email: "nurse@nls-demo.com",     avatar: null },
] as const;

export type DemoRole = typeof DEMO_USERS[number]["role"];

export function setDemoRole(role: DemoRole) {
  localStorage.setItem("demo_role", role);
}

export function getDemoRole(): DemoRole {
  return (localStorage.getItem("demo_role") as DemoRole) || "student";
}

export function getDemoUser() {
  const role = getDemoRole();
  return DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[3];
}

export function clearDemoSession() {
  localStorage.removeItem("demo_role");
}
