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
import NotFound from "./pages/NotFound";

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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
