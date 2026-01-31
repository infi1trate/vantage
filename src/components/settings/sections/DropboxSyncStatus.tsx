/**
 * Dropbox Sync Status Card
 * 
 * Shows sync statistics, last attempt/error info, and retry controls in Settings only.
 * Sync failures are silent elsewhere in the app.
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  CloudIcon, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  AlertCircle,
  FileUp,
  Bug
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { triggerAutoSync } from "@/lib/dropboxSync";

interface SyncStats {
  totalSynced: number;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  totalSizeBytes: number;
  // New: retry info for pending items
  pendingWithRetry: number;
  nextRetryAt: string | null;
}

interface PendingSync {
  session_id: string;
  sync_status: string;
}

interface DropboxSyncStatusProps {
  isConnected: boolean;
}

export function DropboxSyncStatus({ isConnected }: DropboxSyncStatusProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryingPending, setRetryingPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [debugUploading, setDebugUploading] = useState(false);
  const [listingFiles, setListingFiles] = useState(false);
  const [debugLog, setDebugLog] = useState<string | null>(null);
  
  // Track if any upload/sync is actively in progress (from DB state)
  const [activeUploadInProgress, setActiveUploadInProgress] = useState(false);

  useEffect(() => {
    if (user && isConnected) {
      fetchSyncStats();
    } else {
      setLoading(false);
    }
  }, [user, isConnected]);

  // Auto-retry polling: Check for pending retries and trigger them automatically
  useEffect(() => {
    if (!user || !isConnected || !stats?.pending) return;
    
    // Check every 10 seconds for retries that are ready
    const interval = setInterval(async () => {
      if (!stats?.nextRetryAt) return;
      
      const nextRetry = new Date(stats.nextRetryAt);
      const now = new Date();
      
      // If retry time has passed, trigger syncs for pending items
      if (now >= nextRetry) {
        console.log("[DropboxSyncStatus] Retry time reached, triggering pending syncs...");
        
        // Get pending sessions that need retry
        const { data: pendingSessions } = await supabase
          .from("dropbox_sync_status")
          .select("session_id, next_retry_at")
          .eq("user_id", user.id)
          .eq("sync_status", "pending")
          .not("next_retry_at", "is", null);
        
        if (pendingSessions && pendingSessions.length > 0) {
          // Trigger retries for sessions whose retry time has passed
          for (const session of pendingSessions) {
            if (session.next_retry_at && new Date(session.next_retry_at) <= now) {
              try {
                await triggerAutoSync(session.session_id);
              } catch (err) {
                console.warn("[DropboxSyncStatus] Retry trigger failed:", err);
              }
            }
          }
          
          // Refresh stats after triggering
          await fetchSyncStats();
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [user, isConnected, stats?.pending, stats?.nextRetryAt]);

  const fetchSyncStats = async () => {
    if (!user) return;

    try {
      // Include next_retry_at for pending retry info
      const { data, error } = await supabase
        .from("dropbox_sync_status")
        .select("sync_status, completed_at, started_at, file_size_bytes, error_message, updated_at, dropbox_file_id, dropbox_path, next_retry_at, attempt_count")
        .eq("user_id", user.id);

      if (error) throw error;

      // Only count as "synced" if status is completed AND file was actually uploaded
      // (verified by presence of dropbox_file_id or dropbox_path)
      const synced = data?.filter(s => 
        s.sync_status === "completed" && (s.dropbox_file_id || s.dropbox_path)
      ) || [];
      const pending = data?.filter(s => 
        s.sync_status === "pending" || s.sync_status === "syncing"
      ) || [];
      // Failed includes explicit failures AND "completed" without actual upload
      const failed = data?.filter(s => 
        s.sync_status === "failed" || 
        (s.sync_status === "completed" && !s.dropbox_file_id && !s.dropbox_path)
      ) || [];

      // Check if there's an active "syncing" status (not stale)
      const activelySyncing = data?.filter(s => {
        if (s.sync_status !== "syncing") return false;
        if (!s.started_at) return false;
        // Consider stale if started more than 10 minutes ago
        const elapsedMs = Date.now() - new Date(s.started_at).getTime();
        return elapsedMs < 10 * 60 * 1000; // 10 minutes
      }) || [];
      
      setActiveUploadInProgress(activelySyncing.length > 0);

      // Find most recent completed sync
      const completedSyncs = synced.filter(s => s.completed_at);
      const lastSync = completedSyncs.length > 0
        ? completedSyncs.reduce((latest, current) => {
            return new Date(current.completed_at!) > new Date(latest.completed_at!) 
              ? current 
              : latest;
          })
        : null;

      // Find most recent attempt (any status)
      const allRecords = data || [];
      const lastAttempt = allRecords.length > 0
        ? allRecords.reduce((latest, current) => {
            const latestTime = latest.started_at || latest.updated_at;
            const currentTime = current.started_at || current.updated_at;
            return new Date(currentTime) > new Date(latestTime) ? current : latest;
          })
        : null;

      // Find most recent error
      const failedRecords = failed.filter(f => f.error_message);
      const lastFailed = failedRecords.length > 0
        ? failedRecords.reduce((latest, current) => {
            return new Date(current.updated_at) > new Date(latest.updated_at) 
              ? current 
              : latest;
          })
        : null;

      // Calculate total synced size
      const totalSize = synced.reduce((sum, s) => sum + (s.file_size_bytes || 0), 0);
      
      // Count pending items with scheduled retries
      const pendingWithRetry = pending.filter(p => p.next_retry_at).length;
      
      // Find next retry time
      const pendingRetries = pending.filter(p => p.next_retry_at);
      const soonestRetry = pendingRetries.length > 0
        ? pendingRetries.reduce((soonest, current) => {
            return new Date(current.next_retry_at!) < new Date(soonest.next_retry_at!)
              ? current
              : soonest;
          })
        : null;

      setStats({
        totalSynced: synced.length,
        pending: pending.length,
        failed: failed.length,
        lastSyncAt: lastSync?.completed_at || null,
        lastAttemptAt: lastAttempt?.started_at || lastAttempt?.updated_at || null,
        lastError: lastFailed?.error_message || null,
        totalSizeBytes: totalSize,
        pendingWithRetry,
        nextRetryAt: soonestRetry?.next_retry_at || null,
      });
    } catch (error) {
      console.error("[DropboxSyncStatus] Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestWrite = async () => {
    setTesting(true);

    try {
      const response = await supabase.functions.invoke("dropbox-sync", {
        headers: { "x-custom-path": "/test" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        toast.success("Test write successful", {
          description: "Dropbox connection is working correctly.",
        });
      } else {
        toast.error("Test write failed", {
          description: response.data?.error || "Could not write to Dropbox. Try reconnecting.",
        });
      }
    } catch (error) {
      console.error("[DropboxSyncStatus] Test write error:", error);
      toast.error("Test write failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!user) return;

    setRetrying(true);

    try {
      // Get failed syncs
      const { data: failedSyncs, error: fetchError } = await supabase
        .from("dropbox_sync_status")
        .select("session_id")
        .eq("user_id", user.id)
        .eq("sync_status", "failed");

      if (fetchError) throw fetchError;

      if (!failedSyncs || failedSyncs.length === 0) {
        toast.info("No failed syncs to retry");
        return;
      }

      // Mark all failed as pending
      const { error: updateError } = await supabase
        .from("dropbox_sync_status")
        .update({ 
          sync_status: "pending",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("sync_status", "failed");

      if (updateError) throw updateError;

      // Trigger sync for each session
      let triggeredCount = 0;
      for (const sync of failedSyncs) {
        try {
          await triggerAutoSync(sync.session_id);
          triggeredCount++;
        } catch (err) {
          console.warn(`[DropboxSyncStatus] Failed to trigger sync for ${sync.session_id}:`, err);
        }
      }

      toast.success(`Queued ${triggeredCount} recording(s) for retry`, {
        description: "Syncing will continue in the background",
      });

      // Refresh stats
      await fetchSyncStats();
    } catch (error) {
      console.error("[DropboxSyncStatus] Retry failed:", error);
      toast.error("Failed to retry syncs");
    } finally {
      setRetrying(false);
    }
  };

  const handleRetryPending = async () => {
    if (!user) return;

    setRetryingPending(true);

    try {
      // Get pending/syncing syncs that might be stuck
      const { data: pendingSyncs, error: fetchError } = await supabase
        .from("dropbox_sync_status")
        .select("session_id, sync_status")
        .eq("user_id", user.id)
        .in("sync_status", ["pending", "syncing"]);

      if (fetchError) throw fetchError;

      if (!pendingSyncs || pendingSyncs.length === 0) {
        toast.info("No pending uploads to retry");
        return;
      }

      // Trigger sync for each session
      let triggeredCount = 0;
      for (const sync of pendingSyncs) {
        try {
          await triggerAutoSync(sync.session_id);
          triggeredCount++;
        } catch (err) {
          console.warn(`[DropboxSyncStatus] Failed to trigger sync for ${sync.session_id}:`, err);
        }
      }

      toast.success(`Re-triggered ${triggeredCount} pending upload(s)`, {
        description: "Syncing will continue in the background",
      });

      // Refresh stats
      await fetchSyncStats();
    } catch (error) {
      console.error("[DropboxSyncStatus] Retry pending error:", error);
      toast.error("Failed to retry pending uploads");
    } finally {
      setRetryingPending(false);
    }
  };

  const handleSyncExisting = async () => {
    if (!user) return;

    setSyncingAll(true);
    setDebugLog(null);

    const log = (msg: string) => {
      console.log(`[SyncAll] ${msg}`);
      setDebugLog(prev => (prev ? `${prev}\n${msg}` : msg));
    };

    try {
      log("Fetching recordings to sync...");
      
      // Get all sessions with "ready" status
      const { data: allSessions, error: sessionsError } = await supabase
        .from("capture_sessions")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("status", "ready");

      if (sessionsError) throw sessionsError;

      if (!allSessions || allSessions.length === 0) {
        log("No recordings found");
        toast.info("No recordings to sync");
        setSyncingAll(false);
        return;
      }

      log(`Found ${allSessions.length} total recordings`);

      // Get existing sync records with their status
      const { data: existingSyncs, error: syncsError } = await supabase
        .from("dropbox_sync_status")
        .select("session_id, sync_status, dropbox_file_id, dropbox_path")
        .eq("user_id", user.id);

      if (syncsError) throw syncsError;

      // Build a map of session_id -> sync info
      const syncStatusMap = new Map<string, { status: string; verified: boolean }>();
      for (const sync of existingSyncs || []) {
        const verified = !!(sync.dropbox_file_id || sync.dropbox_path);
        syncStatusMap.set(sync.session_id, { 
          status: sync.sync_status,
          verified: sync.sync_status === "completed" && verified,
        });
      }

      // Find sessions that need syncing:
      // 1. No sync record at all (never attempted)
      // 2. sync_status = "pending" (stuck pending)
      // 3. sync_status = "failed" (previously failed)
      // 4. sync_status = "completed" but not verified (completed without actual file)
      const sessionsToSync = allSessions.filter(s => {
        const info = syncStatusMap.get(s.id);
        if (!info) return true; // Never attempted
        if (info.status === "pending" || info.status === "failed") return true;
        if (info.status === "completed" && !info.verified) return true; // Ghost completed
        return false;
      });

      if (sessionsToSync.length === 0) {
        log("All recordings are already verified synced");
        toast.info("All recordings are already synced");
        setSyncingAll(false);
        return;
      }

      log(`${sessionsToSync.length} recordings need syncing`);
      log("");
      log("─── SYNC PROGRESS ───");

      toast.info(`Syncing ${sessionsToSync.length} recording(s)...`, {
        description: "This may take a while for large files",
      });

      // Track results
      let successCount = 0;
      let failCount = 0;

      // Process each recording synchronously to get real results
      for (let i = 0; i < sessionsToSync.length; i++) {
        const session = sessionsToSync[i];
        const progress = `[${i + 1}/${sessionsToSync.length}]`;
        
        log(`${progress} Syncing: ${session.title || session.id.slice(0, 8)}...`);

        try {
          // Update attempt tracking
          await supabase
            .from("dropbox_sync_status")
            .upsert({
              session_id: session.id,
              user_id: user.id,
              sync_status: "syncing",
              last_attempt_at: new Date().toISOString(),
              error_message: null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "session_id",
            });

          // Use SYNCHRONOUS /sync endpoint (not /sync/auto)
          const startTime = Date.now();
          const response = await supabase.functions.invoke("dropbox-sync", {
            body: { sessionId: session.id },
            headers: { "x-custom-path": "/sync" },
          });
          const elapsed = Date.now() - startTime;

          if (response.error) {
            // Edge function returned an error
            log(`${progress} ✗ FAILED (${elapsed}ms): ${response.error.message}`);
            
            await supabase
              .from("dropbox_sync_status")
              .update({
                sync_status: "failed",
                error_message: response.error.message,
                last_attempt_at: new Date().toISOString(),
                attempt_count: supabase.rpc ? undefined : 1, // Increment handled separately if needed
                updated_at: new Date().toISOString(),
              })
              .eq("session_id", session.id);
            
            failCount++;
            continue;
          }

          const data = response.data;

          // Check if upload was verified
          if (data?.verified_exists && data?.dropbox_file_id) {
            log(`${progress} ✓ SUCCESS (${elapsed}ms)`);
            log(`    Method: ${data.method_used || "unknown"}`);
            log(`    Path: ${data.target_path || "(unknown)"}`);
            log(`    Size: ${data.size_bytes ? `${(data.size_bytes / 1024 / 1024).toFixed(2)} MB` : "(unknown)"}`);
            
            // Update with verified data and method used
            await supabase
              .from("dropbox_sync_status")
              .update({
                sync_status: "completed",
                dropbox_path: data.target_path,
                dropbox_file_id: data.dropbox_file_id,
                file_size_bytes: data.size_bytes,
                method_used: data.method_used,
                completed_at: new Date().toISOString(),
                error_message: null,
                updated_at: new Date().toISOString(),
              })
              .eq("session_id", session.id);
            
            successCount++;
          } else {
            // Returned success but not verified
            const errorMsg = data?.error || "Upload returned but verification failed";
            log(`${progress} ⚠ UNVERIFIED (${elapsed}ms): ${errorMsg}`);
            
            await supabase
              .from("dropbox_sync_status")
              .update({
                sync_status: "failed",
                error_message: errorMsg,
                method_used: data?.method_used,
                last_attempt_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("session_id", session.id);
            
            failCount++;
          }

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          log(`${progress} ✗ EXCEPTION: ${errorMsg}`);
          
          await supabase
            .from("dropbox_sync_status")
            .update({
              sync_status: "failed",
              error_message: errorMsg,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("session_id", session.id);
          
          failCount++;
        }

        // Small delay between requests to avoid rate limiting
        if (i < sessionsToSync.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      log("");
      log("─── SYNC COMPLETE ───");
      log(`Success: ${successCount}`);
      log(`Failed: ${failCount}`);
      log("─────────────────────");

      // Show summary toast
      if (successCount > 0 && failCount === 0) {
        toast.success(`All ${successCount} recording(s) synced successfully!`);
      } else if (successCount > 0) {
        toast.warning(`Synced ${successCount} recording(s), ${failCount} failed`);
      } else {
        toast.error(`All ${failCount} recording(s) failed to sync`);
      }

      // Refresh stats
      await fetchSyncStats();

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log(`EXCEPTION: ${msg}`);
      toast.error("Failed to sync recordings", { description: msg });
    } finally {
      setSyncingAll(false);
    }
  };

  /**
   * DEBUG: Upload first (oldest) recording to Dropbox with detailed logging
   * This is a diagnostic tool to verify the sync pipeline works end-to-end.
   */
  const handleDebugUploadFirst = async () => {
    if (!user) return;

    // Prevent double-clicks by checking if already uploading
    if (debugUploading) {
      console.log("[DebugUpload] Already uploading, ignoring click");
      return;
    }

    setDebugUploading(true);
    setDebugLog(null);

    const log = (msg: string) => {
      console.log(`[DebugUpload] ${msg}`);
      setDebugLog(prev => (prev ? `${prev}\n${msg}` : msg));
    };

    try {
      log("Finding oldest recording...");

      // Get the oldest ready session
      const { data: sessions, error: sessionError } = await supabase
        .from("capture_sessions")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: true })
        .limit(1);

      if (sessionError) {
        log(`ERROR: Failed to query sessions: ${sessionError.message}`);
        return;
      }

      if (!sessions || sessions.length === 0) {
        log("No ready recordings found");
        toast.info("No recordings available to upload");
        return;
      }

      const session = sessions[0];
      log(`Selected session: ${session.id}`);
      log(`Title: "${session.title}"`);
      log(`Created: ${session.created_at}`);

      // ===== IDEMPOTENCY CHECK: Check current sync status before proceeding =====
      const { data: existingStatus } = await supabase
        .from("dropbox_sync_status")
        .select("sync_status, dropbox_file_id, dropbox_path, started_at")
        .eq("session_id", session.id)
        .single();

      if (existingStatus) {
        // Already synced and verified
        if (existingStatus.sync_status === "completed" && existingStatus.dropbox_file_id) {
          log(`✓ Already synced: ${existingStatus.dropbox_path}`);
          log(`  dropbox_file_id: ${existingStatus.dropbox_file_id}`);
          toast.info("Already synced to Dropbox", {
            description: existingStatus.dropbox_path || "File exists",
          });
          return;
        }

        // Currently syncing - check if stale
        if (existingStatus.sync_status === "syncing" && existingStatus.started_at) {
          const startedAt = new Date(existingStatus.started_at).getTime();
          const elapsedMs = Date.now() - startedAt;
          const elapsedSecs = Math.round(elapsedMs / 1000);

          if (elapsedMs < 5 * 60 * 1000) { // 5 minutes
            log(`⏳ Upload already in progress (started ${elapsedSecs}s ago)`);
            toast.info("Upload already in progress", {
              description: `Started ${elapsedSecs} seconds ago`,
            });
            return;
          } else {
            log(`⚠ Found stale lock (${elapsedSecs}s old) - will retry`);
          }
        }
      }
      // ===== END IDEMPOTENCY CHECK =====

      // Get video asset info
      const { data: asset, error: assetError } = await supabase
        .from("video_assets")
        .select("id, storage_path, storage_url, file_size_bytes, status")
        .eq("session_id", session.id)
        .single();

      if (assetError) {
        log(`ERROR: No video asset found: ${assetError.message}`);
        return;
      }

      log(`Video asset ID: ${asset.id}`);
      log(`Storage path: ${asset.storage_path || "(none)"}`);
      log(`Storage URL: ${asset.storage_url ? "(present)" : "(none)"}`);
      log(`File size: ${asset.file_size_bytes ? `${(asset.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : "(unknown)"}`);
      log(`Asset status: ${asset.status}`);

      log("Triggering SYNCHRONOUS Dropbox sync (waiting for completion)...");
      log("Using /sync endpoint (not /sync/auto)...");
      
      // Use synchronous /sync endpoint instead of /sync/auto
      // This waits for the actual upload to complete before returning
      const startTime = Date.now();
      const response = await supabase.functions.invoke("dropbox-sync", {
        body: { sessionId: session.id },
        headers: { "x-custom-path": "/sync" },
      });

      const elapsed = Date.now() - startTime;
      log(`Edge function responded in ${elapsed}ms`);

      if (response.error) {
        log(`ERROR: Edge function error: ${response.error.message}`);
        toast.error("Debug upload failed", {
          description: response.error.message,
        });
        return;
      }

      // Log the structured response from edge function
      const data = response.data;
      log("─── DROPBOX SYNC RESULT ───");
      log(`success: ${data?.success ?? false}`);
      
      // Handle idempotency responses
      if (data?.already_synced) {
        log(`already_synced: true`);
        log(`target_path: ${data?.target_path ?? "(none)"}`);
        log(`dropbox_file_id: ${data?.dropbox_file_id ?? "(none)"}`);
        log("───────────────────────────");
        log("✓ File was already synced to Dropbox");
        toast.info("Already synced", {
          description: data.target_path || "File already exists in Dropbox",
        });
        await fetchSyncStats();
        return;
      }
      
      if (data?.in_progress) {
        log(`in_progress: true`);
        log(`started_seconds_ago: ${data?.started_seconds_ago ?? "(unknown)"}`);
        log("───────────────────────────");
        log("⏳ Upload already in progress");
        toast.info("Upload in progress", {
          description: `Started ${data.started_seconds_ago || "recently"}s ago`,
        });
        return;
      }
      
      log(`method_used: ${data?.method_used ?? "(none)"}`);
      log(`target_path: ${data?.target_path ?? "(none)"}`);
      log(`dropbox_file_id: ${data?.dropbox_file_id ?? "(none)"}`);
      log(`dropbox_rev: ${data?.dropbox_rev ?? "(none)"}`);
      log(`size_bytes: ${data?.size_bytes ? `${(data.size_bytes / 1024 / 1024).toFixed(2)} MB` : "(none)"}`);
      log(`verified_exists: ${data?.verified_exists ?? false}`);
      if (data?.error) {
        log(`error: ${data.error}`);
      }
      log("───────────────────────────");

      // Check database sync status for confirmation
      const { data: finalStatus } = await supabase
        .from("dropbox_sync_status")
        .select("sync_status, dropbox_path, dropbox_file_id, error_message, file_size_bytes")
        .eq("session_id", session.id)
        .single();

      if (finalStatus) {
        log("─── DATABASE SYNC STATUS ───");
        log(`sync_status: ${finalStatus.sync_status}`);
        log(`dropbox_path: ${finalStatus.dropbox_path || "(not set)"}`);
        log(`dropbox_file_id: ${finalStatus.dropbox_file_id || "(not set)"}`);
        log(`file_size_bytes: ${finalStatus.file_size_bytes ? `${(finalStatus.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : "(not set)"}`);
        if (finalStatus.error_message) {
          log(`error_message: ${finalStatus.error_message}`);
        }
        log("────────────────────────────");
      }

      // Verify success based on actual data
      const isVerifiedSuccess = data?.verified_exists === true && data?.dropbox_file_id;
      
      if (isVerifiedSuccess) {
        log("✓ SUCCESS: File uploaded and VERIFIED in Dropbox!");
        toast.success("Debug upload succeeded", {
          description: `File verified at ${data.target_path}`,
        });
      } else if (data?.success && !data?.verified_exists) {
        log("⚠ WARNING: Upload returned success but file NOT verified");
        toast.warning("Upload status unclear", {
          description: "Upload completed but verification failed",
        });
      } else {
        log("✗ FAILED: Upload did not complete successfully");
        toast.error("Debug upload failed", {
          description: data?.error || "Upload verification failed",
        });
      }

      // Refresh stats
      await fetchSyncStats();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log(`EXCEPTION: ${msg}`);
      toast.error("Debug upload failed", { description: msg });
    } finally {
      setDebugUploading(false);
    }
  };

  const handleListDropboxFiles = async () => {
    if (!user) return;

    setListingFiles(true);
    setDebugLog(null);

    const log = (msg: string) => {
      console.log(`[ListDropbox] ${msg}`);
      setDebugLog(prev => (prev ? `${prev}\n${msg}` : msg));
    };

    try {
      log("Fetching Dropbox Recordings folder contents...");
      
      const response = await supabase.functions.invoke("dropbox-sync", {
        headers: { "x-custom-path": "/list-recordings" },
      });

      if (response.error) {
        log(`ERROR: ${response.error.message}`);
        toast.error("Failed to list Dropbox files", {
          description: response.error.message,
        });
        return;
      }

      const data = response.data;
      
      log("─── DROPBOX FOLDER STATUS ───");
      log(`folder_reachable: ${data?.folder_reachable ?? false}`);
      log(`folder_exists: ${data?.folder_exists ?? false}`);
      log(`folder_path: ${data?.folder_path ?? "(unknown)"}`);
      log(`file_count: ${data?.file_count ?? 0}`);
      
      if (data?.message) {
        log(`message: ${data.message}`);
      }
      
      if (data?.error) {
        log(`error: ${data.error}`);
      }

      log("───────────────────────────");

      if (data?.files && data.files.length > 0) {
        log("");
        log("─── FILES IN DROPBOX ───");
        for (const file of data.files) {
          const sizeStr = formatBytes(file.size_bytes || 0);
          const dateStr = file.modified 
            ? new Date(file.modified).toLocaleString() 
            : "(unknown date)";
          log(`• ${file.name}`);
          log(`  Size: ${sizeStr}`);
          log(`  Modified: ${dateStr}`);
          log(`  ID: ${file.id || "(none)"}`);
        }
        log("────────────────────────");
        
        toast.success(`Found ${data.files.length} file(s) in Dropbox`);
      } else if (data?.folder_reachable) {
        toast.info("Dropbox folder reachable but empty");
      } else {
        toast.warning("Could not reach Dropbox folder");
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log(`EXCEPTION: ${msg}`);
      toast.error("Failed to list Dropbox files", { description: msg });
    } finally {
      setListingFiles(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (!isConnected) {
    return null;
  }

  if (loading) {
    return (
      <SettingsCard 
        title="Dropbox backup status"
        description="View sync activity and retry failed backups."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard 
      title="Dropbox backup status"
      description="View sync activity and retry failed backups."
    >
      <div className="space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Backed up */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-vantage-success" />
              <span className="text-xs text-muted-foreground">Backed up</span>
            </div>
            <p className="text-xl font-bold font-mono-data text-foreground">
              {stats?.totalSynced || 0}
            </p>
          </div>

          {/* Pending / Backing up */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              {(stats?.pending || 0) > 0 ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {(stats?.pending || 0) > 0 ? "Backing up..." : "Pending"}
              </span>
            </div>
            <p className={cn(
              "text-xl font-bold font-mono-data",
              (stats?.pending || 0) > 0 ? "text-primary" : "text-foreground"
            )}>
              {stats?.pending || 0}
            </p>
            {/* Show retry info if pending items have scheduled retries */}
            {stats?.nextRetryAt && (stats?.pending || 0) > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(stats.nextRetryAt) > new Date()
                  ? `Retry ${formatDistanceToNow(new Date(stats.nextRetryAt), { addSuffix: true })}`
                  : "Retrying now..."}
              </p>
            )}
          </div>

          {/* Failed */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className={cn(
                "h-4 w-4",
                (stats?.failed || 0) > 0 ? "text-destructive" : "text-muted-foreground"
              )} />
              <span className="text-xs text-muted-foreground">Failed</span>
            </div>
            <p className={cn(
              "text-xl font-bold font-mono-data",
              (stats?.failed || 0) > 0 ? "text-destructive" : "text-foreground"
            )}>
              {stats?.failed || 0}
            </p>
          </div>

          {/* Total size */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <CloudIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total size</span>
            </div>
            <p className="text-xl font-bold font-mono-data text-foreground">
              {formatBytes(stats?.totalSizeBytes || 0)}
            </p>
          </div>
        </div>

        {/* Last sync/attempt info */}
        <div className="text-sm text-muted-foreground space-y-1">
          {stats?.lastSyncAt && (
            <p>
              Last successful backup: {formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true })}
            </p>
          )}
          {stats?.lastAttemptAt && stats.lastAttemptAt !== stats.lastSyncAt && (
            <p>
              Last sync attempt: {format(new Date(stats.lastAttemptAt), "MMM d, h:mm a")}
            </p>
          )}
        </div>

        {/* Last error - shown only if there are failures */}
        {stats?.lastError && (stats?.failed || 0) > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">Last error</p>
                <p className="text-xs text-destructive/80 mt-1 break-words">
                  {stats.lastError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No syncs yet */}
        {stats && stats.totalSynced === 0 && stats.pending === 0 && stats.failed === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>No recordings have been synced yet. New recordings will sync automatically.</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Test Write button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestWrite}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Test Write
              </>
            )}
          </Button>

          {/* Retry Pending button - only show if there are pending syncs */}
          {(stats?.pending || 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryPending}
              disabled={retryingPending}
            >
              {retryingPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Pending ({stats?.pending})
                </>
              )}
            </Button>
          )}

          {/* Retry Failed button - only show if there are failed syncs */}
          {(stats?.failed || 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFailed}
              disabled={retrying}
            >
              {retrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Failed ({stats?.failed})
                </>
              )}
            </Button>
          )}

          {/* Sync Existing Recordings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncExisting}
            disabled={syncingAll || activeUploadInProgress}
          >
            {syncingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing…
              </>
            ) : activeUploadInProgress ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sync in progress
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync existing recordings
              </>
            )}
          </Button>

          {/* Debug: Upload first recording button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDebugUploadFirst}
            disabled={debugUploading || listingFiles || activeUploadInProgress}
            className="border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
          >
            {debugUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : activeUploadInProgress ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upload in progress
              </>
            ) : (
              <>
                <Bug className="h-4 w-4 mr-2" />
                Upload first recording now
              </>
            )}
          </Button>

          {/* Debug: List Dropbox recordings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleListDropboxFiles}
            disabled={listingFiles || debugUploading}
            className="border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
          >
            {listingFiles ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Listing...
              </>
            ) : (
              <>
                <CloudIcon className="h-4 w-4 mr-2" />
                List Dropbox recordings
              </>
            )}
          </Button>
        </div>

        {/* Debug log output */}
        {debugLog && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground font-sans text-sm">Debug Log</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
                onClick={() => setDebugLog(null)}
              >
                Clear
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-foreground/80 overflow-x-auto max-h-48 overflow-y-auto">
              {debugLog}
            </pre>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
