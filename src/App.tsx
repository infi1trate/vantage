import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { JobsProvider } from "@/contexts/JobsContext";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Capture from "./pages/Capture";
import SessionReview from "./pages/SessionReview";
import SessionLibrary from "./pages/SessionLibrary";
import Insights from "./pages/Insights";
import Community from "./pages/Community";
import CommunityPost from "./pages/CommunityPost";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Dashboard />, errorElement: <RouteErrorFallback /> },
  { path: "/auth", element: <Auth />, errorElement: <RouteErrorFallback /> },
  { path: "/library", element: <SessionLibrary />, errorElement: <RouteErrorFallback /> },
  { path: "/insights", element: <Insights />, errorElement: <RouteErrorFallback /> },
  { path: "/community", element: <Community />, errorElement: <RouteErrorFallback /> },
  { path: "/community/:postId", element: <CommunityPost />, errorElement: <RouteErrorFallback /> },
  { path: "/community/p/:token", element: <CommunityPost />, errorElement: <RouteErrorFallback /> },
  { path: "/capture/:sessionId", element: <Capture />, errorElement: <RouteErrorFallback /> },
  { path: "/session/:sessionId", element: <SessionReview />, errorElement: <RouteErrorFallback /> },
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <JobsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} />
        </TooltipProvider>
      </JobsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
