import { useNavigate, useLocation } from "react-router-dom";
import { useCallback, useEffect, useRef } from "react";

/**
 * Provides safe back navigation that:
 * 1. Uses browser history if there's in-app navigation history
 * 2. Falls back to a specified route (default: /library) if no history exists
 * 
 * This prevents users from being navigated to "/" unexpectedly when:
 * - Opening a deep link in a new tab
 * - Refreshing the page
 * - Entering via external link
 */
export function useSafeBack(fallbackRoute: string = "/library") {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track if we have internal navigation history
  // We consider history valid if the user navigated to this page from within the app
  const hasInternalHistoryRef = useRef(false);
  const initialKeyRef = useRef(location.key);
  
  useEffect(() => {
    // If location.key changed from the initial one, we have internal navigation
    // The "default" key indicates a fresh navigation (direct URL, new tab, refresh)
    if (location.key !== "default" && location.key !== initialKeyRef.current) {
      hasInternalHistoryRef.current = true;
    }
    
    // Also check if history length suggests prior navigation
    // Note: This is a heuristic - history.length > 1 means there's some history,
    // but it could be from other sites. We combine this with the key check.
    if (window.history.length > 2) {
      hasInternalHistoryRef.current = true;
    }
  }, [location.key]);

  const goBack = useCallback(() => {
    // Check if we have meaningful browser history to go back to
    // history.length of 1 or 2 typically means fresh session/new tab
    const hasBrowserHistory = window.history.length > 2;
    
    // If we have history evidence, use browser back
    if (hasBrowserHistory && hasInternalHistoryRef.current) {
      navigate(-1);
    } else {
      // No reliable history - use fallback route
      navigate(fallbackRoute, { replace: true });
    }
  }, [navigate, fallbackRoute]);

  return { goBack };
}
