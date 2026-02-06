/**
 * DesktopRouter
 * 
 * Completely isolated router for desktop mode (Electron tray popover).
 * This router ONLY renders /desktop/* routes and nothing else.
 * 
 * Key isolation features:
 * - No main app shell/nav
 * - No access to /dashboard, /library, /community, etc.
 * - All auth redirects go to /desktop/auth
 * - Catch-all redirects to /desktop
 */

import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { DesktopRouteGuard } from "@/components/desktop/DesktopRouteGuard";
import { DESKTOP_ROUTES } from "@/lib/desktopMode";
import { Loader2 } from "lucide-react";

// Lazy load desktop pages
const Desktop = lazy(() => import("@/pages/Desktop"));
const DesktopAuth = lazy(() => import("@/pages/DesktopAuth"));
const DesktopPreview = lazy(() => import("@/pages/DesktopPreview"));

// Loading fallback for lazy routes
function DesktopRouteLoader() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

// Wrap lazy component with Suspense
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  return (
    <Suspense fallback={<DesktopRouteLoader />}>
      <Component />
    </Suspense>
  );
}

// Desktop-only router - no main app routes at all
const desktopRouter = createBrowserRouter([
  {
    // Guard wrapper ensures all navigation stays within /desktop/*
    element: <DesktopRouteGuard />,
    children: [
      // Desktop main page (authenticated)
      { 
        path: DESKTOP_ROUTES.ROOT, 
        element: withSuspense(Desktop) 
      },
      // Desktop auth page
      { 
        path: DESKTOP_ROUTES.AUTH, 
        element: withSuspense(DesktopAuth) 
      },
      // Desktop preview (dev mode)
      { 
        path: DESKTOP_ROUTES.PREVIEW, 
        element: withSuspense(DesktopPreview) 
      },
      // Catch-all: redirect any other path to /desktop
      // This includes /dashboard, /library, /auth, etc.
      { 
        path: "*", 
        element: <Navigate to={DESKTOP_ROUTES.ROOT} replace /> 
      },
    ],
  },
]);

export function DesktopRouter() {
  return <RouterProvider router={desktopRouter} />;
}
