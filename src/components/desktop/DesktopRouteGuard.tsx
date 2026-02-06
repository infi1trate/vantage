/**
 * DesktopRouteGuard
 * 
 * Hard guard that ensures navigation stays within /desktop/* routes.
 * If any route outside desktop is accessed, immediately redirects back to /desktop.
 */

import { useEffect } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { DESKTOP_ROUTES, isDesktopRoute } from "@/lib/desktopMode";

export function DesktopRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If we somehow ended up outside /desktop/*, force redirect back
    if (!isDesktopRoute(location.pathname)) {
      console.warn(
        `[DesktopRouteGuard] Blocked navigation to ${location.pathname}, redirecting to ${DESKTOP_ROUTES.ROOT}`
      );
      navigate(DESKTOP_ROUTES.ROOT, { replace: true });
    }
  }, [location.pathname, navigate]);

  // If current path is not a desktop route, don't render children
  // This prevents any flash of non-desktop content
  if (!isDesktopRoute(location.pathname)) {
    return null;
  }

  return <Outlet />;
}
