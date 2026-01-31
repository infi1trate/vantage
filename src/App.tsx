import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { JobsProvider } from "@/contexts/JobsContext";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { DevPerfOverlay } from "@/components/dev/DevPerfOverlay";
import { Loader2 } from "lucide-react";

// Eagerly load landing page for fast initial render
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load heavy routes - only loaded when navigating to them
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Capture = lazy(() => import("./pages/Capture"));
const SessionReview = lazy(() => import("./pages/SessionReview"));
const SessionLibrary = lazy(() => import("./pages/SessionLibrary"));
const Insights = lazy(() => import("./pages/Insights"));
const Community = lazy(() => import("./pages/Community"));
const CommunityPost = lazy(() => import("./pages/CommunityPost"));

// Loading fallback for lazy routes
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Wrap lazy component with Suspense
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Component />
    </Suspense>
  );
}

const queryClient = new QueryClient();

// Public routes (no auth required)
// App routes (auth required - handled by individual pages)
// Heavy routes are lazy-loaded for faster initial bundle
const router = createBrowserRouter([
  { path: "/", element: <Index />, errorElement: <RouteErrorFallback /> },
  { path: "/auth", element: <Auth />, errorElement: <RouteErrorFallback /> },
  { path: "/dashboard", element: withSuspense(Dashboard), errorElement: <RouteErrorFallback /> },
  { path: "/library", element: withSuspense(SessionLibrary), errorElement: <RouteErrorFallback /> },
  { path: "/insights", element: withSuspense(Insights), errorElement: <RouteErrorFallback /> },
  { path: "/community", element: withSuspense(Community), errorElement: <RouteErrorFallback /> },
  { path: "/community/:postId", element: withSuspense(CommunityPost), errorElement: <RouteErrorFallback /> },
  { path: "/community/p/:token", element: withSuspense(CommunityPost), errorElement: <RouteErrorFallback /> },
  { path: "/capture/:sessionId", element: withSuspense(Capture), errorElement: <RouteErrorFallback /> },
  { path: "/session/:sessionId", element: withSuspense(SessionReview), errorElement: <RouteErrorFallback /> },
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
          {/* Dev-only performance overlay - hidden by default, toggle with Ctrl+Shift+P */}
          <DevPerfOverlay />
        </TooltipProvider>
      </JobsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
