/**
 * Dropbox Sync Status Card
 * 
 * Shows sync statistics and retry controls in Settings only.
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
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SyncStats {
  totalSynced: number;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  totalSizeBytes: number;
}

interface DropboxSyncStatusProps {
  isConnected: boolean;
}

export function DropboxSyncStatus({ isConnected }: DropboxSyncStatusProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

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
        .select("sync_status, completed_at, file_size_bytes")
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

      // Calculate total synced size
      const totalSize = synced.reduce((sum, s) => sum + (s.file_size_bytes || 0), 0);

      setStats({
        totalSynced: synced.length,
        pending: pending.length,
        failed: failed.length,
        lastSyncAt: lastSync?.completed_at || null,
        totalSizeBytes: totalSize,
      });
    } catch (error) {
      console.error("[DropboxSyncStatus] Failed to fetch stats:", error);
    } finally {
      setLoading(false);
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

      // Mark all failed as pending (background job will pick them up)
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

      toast.success(`Queued ${failedSyncs.length} recording(s) for retry`, {
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
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-xl font-bold font-mono-data text-foreground">
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

        {/* Last sync time */}
        {stats?.lastSyncAt && (
          <p className="text-sm text-muted-foreground">
            Last backup: {formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true })}
          </p>
        )}

        {/* No syncs yet */}
        {stats && stats.totalSynced === 0 && stats.pending === 0 && stats.failed === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>No recordings have been synced yet. New recordings will sync automatically.</span>
          </div>
        )}

        {/* Retry button - only show if there are failed syncs */}
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
                Retry failed syncs
              </>
            )}
          </Button>
        )}
      </div>
    </SettingsCard>
  );
}
