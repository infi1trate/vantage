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
  const [debugLog, setDebugLog] = useState<string | null>(null);

  useEffect(() => {
    if (user && isConnected) {
      fetchSyncStats();
    } else {
      setLoading(false);
    }
  }, [user, isConnected]);

  const fetchSyncStats = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("dropbox_sync_status")
        .select("sync_status, completed_at, started_at, file_size_bytes, error_message, updated_at")
        .eq("user_id", user.id);

      if (error) throw error;

      const synced = data?.filter(s => s.sync_status === "completed") || [];
      const pending = data?.filter(s => s.sync_status === "pending" || s.sync_status === "syncing") || [];
      const failed = data?.filter(s => s.sync_status === "failed") || [];

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

      setStats({
        totalSynced: synced.length,
        pending: pending.length,
        failed: failed.length,
        lastSyncAt: lastSync?.completed_at || null,
        lastAttemptAt: lastAttempt?.started_at || lastAttempt?.updated_at || null,
        lastError: lastFailed?.error_message || null,
        totalSizeBytes: totalSize,
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

    try {
      // Get all sessions with "ready" status
      const { data: allSessions, error: sessionsError } = await supabase
        .from("capture_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "ready");

      if (sessionsError) throw sessionsError;

      if (!allSessions || allSessions.length === 0) {
        toast.info("No recordings to sync");
        setSyncingAll(false);
        return;
      }

      // Get existing sync records with their status
      const { data: existingSyncs, error: syncsError } = await supabase
        .from("dropbox_sync_status")
        .select("session_id, sync_status")
        .eq("user_id", user.id);

      if (syncsError) throw syncsError;

      // Build a map of session_id -> sync_status
      const syncStatusMap = new Map<string, string>();
      for (const sync of existingSyncs || []) {
        syncStatusMap.set(sync.session_id, sync.sync_status);
      }

      // Find sessions that need syncing:
      // 1. No sync record at all (never attempted)
      // 2. sync_status = "pending" (stuck pending)
      // 3. sync_status = "failed" (previously failed)
      const sessionsToSync = allSessions.filter(s => {
        const status = syncStatusMap.get(s.id);
        // No record, or pending, or failed = needs sync
        return !status || status === "pending" || status === "failed";
      });

      if (sessionsToSync.length === 0) {
        toast.info("All recordings are already synced or syncing");
        setSyncingAll(false);
        return;
      }

      toast.success("Syncing existing recordings in the background", {
        description: `Queuing ${sessionsToSync.length} recording(s)...`,
      });

      // Process sequentially with a small delay to avoid overwhelming the server
      // This runs in the background - don't await all of them
      let triggeredCount = 0;
      const processQueue = async () => {
        for (const session of sessionsToSync) {
          try {
            // Create or update pending record
            await supabase
              .from("dropbox_sync_status")
              .upsert({
                session_id: session.id,
                user_id: user.id,
                sync_status: "pending",
                error_message: null,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "session_id",
              });

            // Trigger sync
            await triggerAutoSync(session.id);
            triggeredCount++;

            // Small delay between triggers to avoid rate limiting (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.warn(`[DropboxSyncStatus] Failed to queue sync for ${session.id}:`, err);
          }
        }

        console.log(`[DropboxSyncStatus] Finished queuing ${triggeredCount} recordings for sync`);
      };

      // Start processing in background (don't block UI)
      processQueue().finally(() => {
        fetchSyncStats();
      });

      // Refresh stats after a short delay
      setTimeout(() => fetchSyncStats(), 1000);
    } catch (error) {
      console.error("[DropboxSyncStatus] Sync existing error:", error);
      toast.error("Failed to sync existing recordings");
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

      // Create/update sync status to pending
      log("Creating sync status record...");
      const { error: upsertError } = await supabase
        .from("dropbox_sync_status")
        .upsert({
          session_id: session.id,
          user_id: user.id,
          sync_status: "pending",
          error_message: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "session_id",
        });

      if (upsertError) {
        log(`ERROR: Failed to create sync status: ${upsertError.message}`);
        return;
      }

      log("Triggering Dropbox sync via edge function...");
      
      // Call the sync endpoint directly with more detail
      const startTime = Date.now();
      const response = await supabase.functions.invoke("dropbox-sync", {
        body: { sessionId: session.id },
        headers: { "x-custom-path": "/sync/auto" },
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

      log(`Response: ${JSON.stringify(response.data)}`);

      // Check final sync status
      const { data: finalStatus } = await supabase
        .from("dropbox_sync_status")
        .select("sync_status, dropbox_path, error_message, file_size_bytes")
        .eq("session_id", session.id)
        .single();

      if (finalStatus) {
        log(`Final status: ${finalStatus.sync_status}`);
        if (finalStatus.dropbox_path) {
          log(`Dropbox path: ${finalStatus.dropbox_path}`);
        }
        if (finalStatus.file_size_bytes) {
          log(`Uploaded size: ${(finalStatus.file_size_bytes / 1024 / 1024).toFixed(2)} MB`);
        }
        if (finalStatus.error_message) {
          log(`Error: ${finalStatus.error_message}`);
        }
      }

      if (response.data?.success || finalStatus?.sync_status === "completed") {
        log("SUCCESS: Upload completed!");
        toast.success("Debug upload succeeded");
      } else {
        log("Upload may still be processing in background...");
        toast.info("Upload triggered - check logs for result");
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

          {/* Pending */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={cn(
                "h-4 w-4",
                (stats?.pending || 0) > 0 ? "text-amber-500" : "text-muted-foreground"
              )} />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className={cn(
              "text-xl font-bold font-mono-data",
              (stats?.pending || 0) > 0 ? "text-amber-500" : "text-foreground"
            )}>
              {stats?.pending || 0}
            </p>
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
            disabled={syncingAll}
          >
            {syncingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
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
            disabled={debugUploading}
            className="border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
          >
            {debugUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Bug className="h-4 w-4 mr-2" />
                Upload first recording now
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
