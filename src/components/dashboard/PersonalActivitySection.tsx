import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Clock, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptureSession } from "@/lib/captures";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface PersonalActivitySectionProps {
  sessions: CaptureSession[];
  loading: boolean;
}

export function PersonalActivitySection({ sessions, loading }: PersonalActivitySectionProps) {
  const navigate = useNavigate();
  const recentSessions = sessions.slice(0, 5);

  const stats = {
    total: sessions.length,
    totalHours: Math.floor(sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 3600),
    ready: sessions.filter((s) => s.status === "ready").length,
  };

  if (loading) {
    return null; // Don't flash a skeleton for a lightweight section
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-muted-foreground/40" />
          <h2 className="font-display text-2xl tracking-wide">YOUR ACTIVITY</h2>
        </div>
        {sessions.length > 5 && (
          <Button variant="ghost" onClick={() => navigate("/library")} className="uppercase text-xs tracking-wider group">
            Full Library
            <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        )}
      </div>

      {/* Compact stats row */}
      <div className="flex items-center gap-6 mb-5">
        <StatPill icon={Video} label="Captures" value={stats.total} />
        <StatPill icon={Clock} label="Hours" value={stats.totalHours} />
        <StatPill icon={Video} label="Ready" value={stats.ready} accent />
      </div>

      {recentSessions.length === 0 ? (
        <Card className="p-8 border-border/30 border-dashed text-center">
          <p className="text-sm text-muted-foreground">
            No captures yet. Record your first session to see activity here.
          </p>
        </Card>
      ) : (
        <div className="space-y-1">
          {recentSessions.map((session, idx) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <ActivityRow session={session} onClick={() => navigate(`/session/${session.id}`)} />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Video;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("p-1.5 rounded", accent ? "bg-primary/10" : "bg-muted")}>
        <Icon className={cn("h-3.5 w-3.5", accent ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div>
        <span className="font-mono-data text-lg font-semibold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground ml-1.5">{label}</span>
      </div>
    </div>
  );
}

function ActivityRow({ session, onClick }: { session: CaptureSession; onClick: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(session.created_at), { addSuffix: true });
  const duration = session.duration_seconds
    ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
    : null;

  const statusColors: Record<string, string> = {
    ready: "bg-vantage-success/15 text-vantage-success border-vantage-success/20",
    processing: "bg-vantage-warning/15 text-vantage-warning border-vantage-warning/20",
    recording: "bg-destructive/15 text-destructive border-destructive/20",
    failed: "bg-destructive/15 text-destructive border-destructive/20",
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors group text-left"
    >
      {/* Thumbnail */}
      <div className="w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
        {session.thumbnail_url ? (
          <img src={session.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Video className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {session.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {session.game_name && <span>{session.game_name}</span>}
          {session.game_name && duration && <span>·</span>}
          {duration && <span>{duration}</span>}
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Status */}
      <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[session.status] || "")}>
        {session.status}
      </Badge>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}
