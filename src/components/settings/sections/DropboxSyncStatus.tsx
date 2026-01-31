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
  FileUp
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
        </div>
      </div>
    </SettingsCard>
  );
}
