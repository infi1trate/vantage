/**
 * Browser Notifications Utility
 * 
 * Handles requesting permission and showing system notifications.
 * Only requests permission after user interaction (not on load).
 */

// Track if we've ever asked for permission this session
let hasRequestedPermission = false;

/**
 * Check if notifications are supported and available
 */
export function notificationsSupported(): boolean {
  return "Notification" in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Check if we should request permission (not already granted/denied, and haven't asked this session)
 */
export function shouldRequestPermission(): boolean {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "default") return false;
  if (hasRequestedPermission) return false;
  return true;
}

/**
 * Request notification permission after user interaction
 * Returns true if permission was granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  
  hasRequestedPermission = true;
  
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch (error) {
    console.warn("[Notifications] Permission request failed:", error);
    return false;
  }
}

/**
 * Show a system notification if permission is granted
 */
export function showSystemNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (!notificationsSupported()) return null;
  if (Notification.permission !== "granted") return null;
  
  try {
    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    return notification;
  } catch (error) {
    console.warn("[Notifications] Failed to show notification:", error);
    return null;
  }
}

/**
 * Show a "Video ready" notification with click handler
 */
export function showVideoReadyNotification(
  sessionTitle: string,
  onClick?: () => void
): Notification | null {
  const notification = showSystemNotification(
    "Vantage: Video ready",
    {
      body: `${sessionTitle} is ready for review`,
      tag: "video-ready", // Replaces existing with same tag
      requireInteraction: false,
    }
  );
  
  if (notification && onClick) {
    notification.onclick = () => {
      onClick();
      notification.close();
      // Focus the window when clicking notification
      window.focus();
    };
  }
  
  return notification;
}
