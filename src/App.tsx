import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";
import BackgroundRemoval from "./pages/BackgroundRemoval";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/bg-removal" element={<BackgroundRemoval />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/preferences"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentPreferences />
              </ProtectedRoute>
            }
          />
          <Route
            path="/moderator"
            element={
              <ProtectedRoute requiredRole="moderator">
                <ModeratorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/moderator/activities"
            element={
              <ProtectedRoute requiredRole="moderator">
                <ModeratorActivities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/moderator/allocations"
            element={
              <ProtectedRoute requiredRole="moderator">
                <ModeratorAllocations />
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/user-management" element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/activities" element={<ProtectedRoute requiredRole="admin"><ModeratorActivities /></ProtectedRoute>} />
          <Route path="/admin/allocations" element={<ProtectedRoute requiredRole="admin"><ModeratorAllocations /></ProtectedRoute>} />
          <Route path="/admin/view-allocations" element={<ProtectedRoute requiredRole="admin"><AllocationsView /></ProtectedRoute>} />
          <Route path="/admin/manual-allocations" element={<ProtectedRoute requiredRole="admin"><ManualAllocations /></ProtectedRoute>} />
          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute requiredRole="teacher"><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/moderator/view-allocations" element={<ProtectedRoute requiredRole="moderator"><AllocationsView /></ProtectedRoute>} />
          <Route path="/moderator/manual-allocations" element={<ProtectedRoute requiredRole="moderator"><ManualAllocations /></ProtectedRoute>} />
          <Route path="/moderator/attendance" element={<ProtectedRoute requiredRole="moderator"><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute requiredRole="admin"><TeacherAttendance /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
