/**
 * Platform Connections Manager
 * Handles OAuth mock states and connected accounts
 * Structured for future real OAuth integration
 */

export type PlatformId = "youtube" | "tiktok" | "medal" | "twitch" | "twitter" | "instagram" | "facebook" | "discord";

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  supportsDirectUpload: boolean;
  supportsVisibility: boolean;
  supportsScheduling: boolean;
  visibilityOptions?: string[];
  uploadPageUrl: string;
  color: string;
}

export interface ConnectedAccount {
  platformId: PlatformId;
  accountId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  connectedAt: string;
  expiresAt?: string;
}

// Platform configurations
export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    supportsDirectUpload: false, // Set to false until OAuth implemented
    supportsVisibility: true,
    supportsScheduling: true,
    visibilityOptions: ["public", "unlisted", "private"],
    uploadPageUrl: "https://studio.youtube.com/channel/UC/videos/upload",
    color: "text-red-500",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    supportsDirectUpload: false,
    supportsVisibility: false,
    supportsScheduling: false,
    uploadPageUrl: "https://www.tiktok.com/upload",
    color: "text-foreground",
  },
  medal: {
    id: "medal",
    name: "Medal.tv",
    supportsDirectUpload: false,
    supportsVisibility: false,
    supportsScheduling: false,
    uploadPageUrl: "https://medal.tv/upload",
    color: "text-amber-500",
  },
  twitch: {
    id: "twitch",
    name: "Twitch",
    supportsDirectUpload: false,
    supportsVisibility: true,
    supportsScheduling: false,
    visibilityOptions: ["public", "subscribers"],
    uploadPageUrl: "https://www.twitch.tv/videos/upload",
    color: "text-purple-500",
  },
  twitter: {
    id: "twitter",
    name: "X (Twitter)",
    supportsDirectUpload: false,
    supportsVisibility: false,
    supportsScheduling: false,
    uploadPageUrl: "https://twitter.com/compose/tweet",
    color: "text-foreground",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    supportsDirectUpload: false,
    supportsVisibility: false,
    supportsScheduling: false,
    uploadPageUrl: "https://www.instagram.com/",
    color: "text-pink-500",
  },
  facebook: {
    id: "facebook",
    name: "Facebook Gaming",
    supportsDirectUpload: false,
    supportsVisibility: true,
    supportsScheduling: false,
    visibilityOptions: ["public", "friends", "private"],
    uploadPageUrl: "https://www.facebook.com/gaming/",
    color: "text-blue-500",
  },
  discord: {
    id: "discord",
    name: "Discord",
    supportsDirectUpload: false,
    supportsVisibility: false,
    supportsScheduling: false,
    uploadPageUrl: "https://discord.com/",
    color: "text-indigo-500",
  },
};

// Featured platforms shown in the main grid
export const FEATURED_PLATFORMS: PlatformId[] = ["youtube", "tiktok", "medal", "twitch"];

// Additional platforms in "More" list
export const MORE_PLATFORMS: PlatformId[] = ["twitter", "instagram", "facebook", "discord"];

const CONNECTIONS_STORAGE_KEY = "vantage_platform_connections";

/**
 * Load connected accounts from localStorage
 */
export function loadConnections(): ConnectedAccount[] {
  try {
    const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ConnectedAccount[];
  } catch (error) {
    console.error("[PlatformConnections] Failed to load:", error);
    return [];
  }
}

/**
 * Save connected accounts to localStorage
 */
function saveConnections(connections: ConnectedAccount[]): void {
  try {
    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  } catch (error) {
    console.error("[PlatformConnections] Failed to save:", error);
  }
}

/**
 * Get a specific connected account
 */
export function getConnection(platformId: PlatformId): ConnectedAccount | null {
  const connections = loadConnections();
  return connections.find(c => c.platformId === platformId) || null;
}

/**
 * Check if a platform is connected
 */
export function isConnected(platformId: PlatformId): boolean {
  return getConnection(platformId) !== null;
}

/**
 * Connect a platform account (mock implementation)
 * In production, this would initiate OAuth flow
 */
export async function connectPlatform(platformId: PlatformId): Promise<ConnectedAccount> {
  // Simulate OAuth delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Generate mock account data
  const mockAccount: ConnectedAccount = {
    platformId,
    accountId: `${platformId}_${Math.random().toString(36).substring(2, 9)}`,
    handle: `@gamer_${Math.random().toString(36).substring(2, 6)}`,
    displayName: `Player ${Math.floor(Math.random() * 9000) + 1000}`,
    avatarUrl: undefined, // Could add placeholder avatars
    connectedAt: new Date().toISOString(),
  };
  
  const connections = loadConnections();
  // Remove existing connection for this platform if any
  const filtered = connections.filter(c => c.platformId !== platformId);
  filtered.push(mockAccount);
  saveConnections(filtered);
  
  return mockAccount;
}

/**
 * Disconnect a platform account
 */
export function disconnectPlatform(platformId: PlatformId): boolean {
  const connections = loadConnections();
  const filtered = connections.filter(c => c.platformId !== platformId);
  
  if (filtered.length === connections.length) return false;
  
  saveConnections(filtered);
  return true;
}

/**
 * Get all connected accounts
 */
export function getConnectedAccounts(): ConnectedAccount[] {
  return loadConnections();
}

/**
 * Platform-specific publish options
 */
export interface PublishToPlatformOptions {
  platformId: PlatformId;
  title: string;
  description?: string;
  visibility?: string;
  tags?: string[];
  allowComments?: boolean;
  scheduledAt?: string;
}

/**
 * Check if platform requires manual upload (no direct API)
 */
export function requiresManualUpload(platformId: PlatformId): boolean {
  const config = PLATFORMS[platformId];
  return !config.supportsDirectUpload;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("[Clipboard] Failed to copy:", error);
    return false;
  }
}

/**
 * Open platform upload page in new tab
 */
export function openUploadPage(platformId: PlatformId): void {
  const config = PLATFORMS[platformId];
  window.open(config.uploadPageUrl, "_blank", "noopener,noreferrer");
}
