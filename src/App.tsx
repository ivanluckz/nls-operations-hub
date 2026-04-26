import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import PageTransition from "./components/PageTransition";

import { useTheme } from "@/hooks/use-custom-theme";

const SandboxedAnimation = lazy(() => import("./components/SandboxedAnimation"));
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/StudentDashboard";
import StudentPreferences from "./pages/StudentPreferences";
import ModeratorDashboard from "./pages/ModeratorDashboard";
import ModeratorActivities from "./pages/ModeratorActivities";
import ModeratorAllocations from "./pages/ModeratorAllocations";
import ManualAllocations from "./pages/ManualAllocations";
import AdminDashboard from "./pages/AdminDashboard";
import AllocationsView from "./pages/AllocationsView";
import UserManagement from "./pages/UserManagement";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherAttendance from "./pages/TeacherAttendance";
import AttendanceReports from "./pages/AttendanceReports";
import PreExcuseStudents from "./pages/PreExcuseStudents";
import NotFound from "./pages/NotFound";
import BackgroundRemoval from "./pages/BackgroundRemoval";
import WeeklySummary from "./pages/WeeklySummary";
import ActivityChatbot from "./pages/ActivityChatbot";
import ActivityRoster from "./pages/ActivityRoster";
import AdminProfile from "./pages/AdminProfile";
import AdminMessages from "./pages/AdminMessages";
import AdminBadgeRequests from "./pages/AdminBadgeRequests";
import StudentMessages from "./pages/StudentMessages";
import ThemeManagement from "./pages/ThemeManagement";
import Leaderboard from "./pages/Leaderboard";
import DirectMessages from "./pages/DirectMessages";
import SetPassword from "./pages/SetPassword";
import StudentRequests from "./pages/StudentRequests";
import AdminAI from "./pages/AdminAI";
import KitchenReports from "./pages/KitchenReports";
import RLCoachDashboard from "./pages/RLCoachDashboard";
import RLCoachReports from "./pages/RLCoachReports";
import MedicalDashboard from "./pages/MedicalDashboard";
import WeeklyTimetable from "./pages/WeeklyTimetable";
import StudentProfile from "./pages/StudentProfile";
import ThemeMarketplace from "./pages/ThemeMarketplace";
import AdminWorkouts from "./pages/AdminWorkouts";

const queryClient = new QueryClient();

const AppContent = () => {
  const { activeTheme } = useTheme();

  return (
    <>
      {activeTheme?.jsContent && (
        <Suspense fallback={null}>
          <SandboxedAnimation jsContent={activeTheme.jsContent} />
        </Suspense>
      )}
      
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PageTransition>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/bg-removal" element={<BackgroundRemoval />} />
          <Route path="/set-password" element={<SetPassword />} />

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/preferences" element={<ProtectedRoute requiredRole="student"><StudentPreferences /></ProtectedRoute>} />
          <Route path="/student/messages" element={<ProtectedRoute requiredRole="student"><StudentMessages /></ProtectedRoute>} />
          <Route path="/student/leaderboard" element={<ProtectedRoute requiredRole="student"><Leaderboard /></ProtectedRoute>} />
          <Route path="/student/dms" element={<ProtectedRoute requiredRole="student"><DirectMessages /></ProtectedRoute>} />
          <Route path="/student/request" element={<ProtectedRoute requiredRole="student"><StudentRequests /></ProtectedRoute>} />

          {/* Moderator */}
          <Route path="/moderator" element={<ProtectedRoute requiredRole="moderator"><ModeratorDashboard /></ProtectedRoute>} />
          <Route path="/moderator/activities" element={<ProtectedRoute requiredRole="moderator"><ModeratorActivities /></ProtectedRoute>} />
          <Route path="/moderator/allocations" element={<ProtectedRoute requiredRole="moderator"><ModeratorAllocations /></ProtectedRoute>} />
          <Route path="/moderator/view-allocations" element={<ProtectedRoute requiredRole="moderator"><AllocationsView /></ProtectedRoute>} />
          <Route path="/moderator/manual-allocations" element={<ProtectedRoute requiredRole="moderator"><ManualAllocations /></ProtectedRoute>} />
          <Route path="/moderator/attendance" element={<ProtectedRoute requiredRole="moderator"><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/moderator/attendance-reports" element={<ProtectedRoute requiredRole="moderator"><AttendanceReports /></ProtectedRoute>} />
          <Route path="/moderator/pre-excuse" element={<ProtectedRoute requiredRole="moderator"><PreExcuseStudents /></ProtectedRoute>} />
          <Route path="/moderator/weekly-summary" element={<ProtectedRoute requiredRole="moderator"><WeeklySummary /></ProtectedRoute>} />
          <Route path="/moderator/activity-roster" element={<ProtectedRoute requiredRole="moderator"><ActivityRoster /></ProtectedRoute>} />
          <Route path="/moderator/dms" element={<ProtectedRoute requiredRole="moderator"><DirectMessages /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/user-management" element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/activities" element={<ProtectedRoute requiredRole="admin"><ModeratorActivities /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/allocations" element={<ProtectedRoute requiredRole="admin"><ModeratorAllocations /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/view-allocations" element={<ProtectedRoute requiredRole="admin"><AllocationsView /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/manual-allocations" element={<ProtectedRoute requiredRole="admin"><ManualAllocations /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/attendance" element={<ProtectedRoute requiredRole="admin"><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/attendance-reports" element={<ProtectedRoute requiredRole="admin"><AttendanceReports /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/pre-excuse" element={<ProtectedRoute requiredRole="admin"><PreExcuseStudents /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/weekly-summary" element={<ProtectedRoute requiredRole="admin"><WeeklySummary /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/activity-roster" element={<ProtectedRoute requiredRole="admin"><ActivityRoster /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/messages" element={<ProtectedRoute requiredRole="admin"><AdminMessages /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/badge-requests" element={<ProtectedRoute requiredRole="admin"><AdminBadgeRequests /></ProtectedRoute>} />
          <Route path="/admin/dms" element={<ProtectedRoute requiredRole="admin"><DirectMessages /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute requiredRole="admin"><AdminProfile /></ProtectedRoute>} />
          <Route path="/admin/admin-ai" element={<ProtectedRoute requiredRole="admin"><AdminAI /></ProtectedRoute>} />
          <Route path="/admin/meal-reports" element={<ProtectedRoute requiredRole="admin"><KitchenReports /></ProtectedRoute>} />
          <Route path="/admin/workout-reports" element={<ProtectedRoute requiredRole="admin"><RLCoachReports /></ProtectedRoute>} />
          <Route path="/admin/workouts" element={<ProtectedRoute requiredRole="admin"><AdminWorkouts /></ProtectedRoute>} />
          <Route path="/admin/co-curricular/timetable" element={<ProtectedRoute requiredRole="admin"><WeeklyTimetable /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute requiredRole="teacher"><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/teacher/attendance-reports" element={<ProtectedRoute requiredRole="teacher"><AttendanceReports /></ProtectedRoute>} />
          <Route path="/teacher/dms" element={<ProtectedRoute requiredRole="teacher"><DirectMessages /></ProtectedRoute>} />

          {/* RL Coach */}
          <Route path="/rl-coach" element={<ProtectedRoute requiredRole="rl_coach"><RLCoachDashboard /></ProtectedRoute>} />
          <Route path="/rl-coach/reports" element={<ProtectedRoute requiredRole="rl_coach"><RLCoachReports /></ProtectedRoute>} />

          {/* Medical */}
          <Route path="/medical" element={<ProtectedRoute requiredRole="medical"><MedicalDashboard /></ProtectedRoute>} />

          {/* Chatbot — requires auth, any role */}
          <Route path="/chatbot" element={<ProtectedRoute><ActivityChatbot /></ProtectedRoute>} />
          <Route path="/themes" element={<ThemeManagement />} />
          <Route path="/themes/marketplace" element={<ProtectedRoute><ThemeMarketplace /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </PageTransition>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
