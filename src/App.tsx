import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { JobsProvider } from "@/contexts/JobsContext";
import { ProcessingProvider } from "@/contexts/ProcessingContext";
import { ChallengeSessionProvider } from "@/contexts/ChallengeSessionContext";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { DevPerfOverlay } from "@/components/dev/DevPerfOverlay";
import { ProcessingFooter } from "@/components/processing/ProcessingFooter";
import { RenderQueueFooter } from "@/components/processing/RenderQueueFooter";
import { Loader2 } from "lucide-react";
import ExtensionAuth from "./pages/ExtensionAuth";

// Eagerly load landing page for fast initial render
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthDesktop from "./pages/AuthDesktop";
import NotFound from "./pages/NotFound";

// Lazy load heavy routes - only loaded when navigating to them
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Capture = lazy(() => import("./pages/Capture"));
const SessionReview = lazy(() => import("./pages/SessionReview"));
const SessionLibrary = lazy(() => import("./pages/SessionLibrary"));
const ReelEditor = lazy(() => import("./pages/ReelEditor"));
const Insights = lazy(() => import("./pages/Insights"));
const Community = lazy(() => import("./pages/Community"));
const CommunityPost = lazy(() => import("./pages/CommunityPost"));
const Challenges = lazy(() => import("./pages/Challenges"));
const ChallengeDetail = lazy(() => import("./pages/ChallengeDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Desktop = lazy(() => import("./pages/Desktop"));
const DesktopPreview = lazy(() => import("./pages/DesktopPreview"));

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

// Note: Routes moved to routerWithLayout below

// Layout wrapper that includes global footers within Router context
function AppLayout() {
  return (
    <>
      <Outlet />
      {/* Background processing footer - shows active jobs */}
      <ProcessingFooter />
      {/* Render queue footer - shows reel assembly, export, and rendering jobs */}
      <RenderQueueFooter />
      {/* Dev-only performance overlay - hidden by default, toggle with Ctrl+Shift+P */}
      <DevPerfOverlay />
    </>
  );
}

// Create router with layout wrapper for global footers
const routerWithLayout = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/auth", element: <Auth /> },
      { path: "/auth/desktop", element: <AuthDesktop /> },
      { path: "/extension-auth", element: <ExtensionAuth /> },
      { path: "/dashboard", element: withSuspense(Dashboard) },
      { path: "/library", element: withSuspense(SessionLibrary) },
      { path: "/insights", element: withSuspense(Insights) },
      { path: "/community", element: withSuspense(Community) },
      { path: "/community/:postId", element: withSuspense(CommunityPost) },
      { path: "/community/p/:token", element: withSuspense(CommunityPost) },
      { path: "/challenges", element: withSuspense(Challenges) },
      { path: "/challenges/:challengeId", element: withSuspense(ChallengeDetail) },
      { path: "/capture/:sessionId", element: withSuspense(Capture) },
      { path: "/session/:sessionId", element: withSuspense(SessionReview) },
      { path: "/reel/:reelId", element: withSuspense(ReelEditor) },
      { path: "/library/session/:sessionId", element: withSuspense(SessionReview) },
      { path: "/dashboard/session/:sessionId", element: withSuspense(SessionReview) },
      { path: "/settings", element: withSuspense(Settings) },
      { path: "/desktop", element: withSuspense(Desktop) },
      { path: "/desktop/preview", element: withSuspense(DesktopPreview) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <JobsProvider>
        <ProcessingProvider>
          <ChallengeSessionProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <RouterProvider router={routerWithLayout} />
            </TooltipProvider>
          </ChallengeSessionProvider>
        </ProcessingProvider>
      </JobsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
