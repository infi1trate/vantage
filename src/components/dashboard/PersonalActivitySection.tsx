import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Video, ArrowRight, Eye, Scissors, Clock, Film } from "lucide-react";
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
  const recentSessions = sessions.slice(0, 3);

  const glance = useMemo(() => {
    const totalHours = Math.floor(
      sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 3600
    );
    const readyCount = sessions.filter((s) => s.status === "ready").length;
    return { total: sessions.length, totalHours, ready: readyCount };
  }, [sessions]);

  if (loading || recentSessions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-muted-foreground/40" />
          <div>
            <h2 className="font-display text-2xl tracking-wide">YOUR MOMENTUM</h2>
            {/* Compact at-a-glance stats row */}
            <div className="flex items-center gap-4 mt-1">
              <GlanceStat icon={Film} value={glance.total} label="captures" />
              <GlanceStat icon={Clock} value={glance.totalHours} label="hrs recorded" />
              <GlanceStat icon={Eye} value={glance.ready} label="ready" />
            </div>
          </div>
        </div>
        {sessions.length > 3 && (
          <Button
            variant="ghost"
            onClick={() => navigate("/library")}
            className="uppercase text-xs tracking-wider group"
          >
            Full Library
            <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentSessions.map((session, idx) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.08 }}
          >
            <MomentumCard session={session} onClick={() => navigate(`/session/${session.id}`)} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Compact stat (inline) ──────────────────────────────────────────────────

function GlanceStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Video;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span className="font-mono font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  );
}

// ─── Status pill config ─────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  ready: {
    label: "Ready",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  recording: {
    label: "Recording",
    className: "bg-destructive/15 text-destructive border-destructive/20",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive border-destructive/20",
  },
};

function getInsight(session: CaptureSession): { icon: typeof Video; text: string } | null {
  if (session.status === "ready") {
    return { icon: Eye, text: "Ready to review" };
  }
  if (session.status === "processing") {
    return { icon: Scissors, text: "Processing clips" };
  }
  return null;
}

// ─── Momentum Card ──────────────────────────────────────────────────────────

function MomentumCard({ session, onClick }: { session: CaptureSession; onClick: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(session.created_at), { addSuffix: true });
  const duration = session.duration_seconds
    ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
    : null;
  const status = statusConfig[session.status] || statusConfig.ready;
  const insight = getInsight(session);

  return (
    <button onClick={onClick} className="block w-full text-left group">
      <Card
        className={cn(
          "overflow-hidden border-border/30 bg-card/50",
          "hover:border-primary/40 transition-all duration-300",
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
        )}
      >
        {/* Thumbnail */}
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            {session.thumbnail_url ? (
              <img
                src={session.thumbnail_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                <Video className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </AspectRatio>

          {/* Status pill overlay */}
          <div className="absolute top-2 right-2">
            <Badge
              variant="outline"
              className={cn("text-[10px] font-semibold shadow-sm", status.className)}
            >
              {status.label}
            </Badge>
          </div>

          {/* Duration overlay */}
          {duration && (
            <div className="absolute bottom-2 right-2">
              <span className="text-[10px] font-mono bg-background/80 backdrop-blur-sm text-foreground px-1.5 py-0.5 rounded">
                {duration}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5 space-y-1.5">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {session.title}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {session.game_name && (
                <>
                  <span>{session.game_name}</span>
                  <span className="text-border">·</span>
                </>
              )}
              <span>{timeAgo}</span>
            </div>
          </div>

          {/* Contextual insight */}
          {insight && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 pt-0.5">
              <insight.icon className="h-3 w-3" />
              <span>{insight.text}</span>
            </div>
          )}
        </div>
      </Card>
    </button>
  );
}
