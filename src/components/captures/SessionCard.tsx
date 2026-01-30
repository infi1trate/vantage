import { CaptureSession } from "@/lib/captures";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Calendar, Gamepad2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface SessionCardProps {
  session: CaptureSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const statusColors = {
    recording: "bg-destructive/20 text-destructive border-destructive/30",
    processing: "bg-vantage-warning/20 text-vantage-warning border-vantage-warning/30",
    ready: "bg-vantage-success/20 text-vantage-success border-vantage-success/30",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
  };

  return (
    <Link to={`/session/${session.id}`}>
      <Card className="group relative overflow-hidden bg-card border-border/30 hover:border-primary/40 transition-all duration-300 card-hover cursor-pointer">
        {/* Thumbnail */}
        <div className="aspect-video relative bg-muted/30 overflow-hidden">
          {session.thumbnail_url ? (
            <img 
              src={session.thumbnail_url} 
              alt={session.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-card">
              <Gamepad2 className="h-10 w-10 text-muted-foreground/20" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="p-3 rounded-full bg-primary glow-primary">
              <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-background/90 backdrop-blur-sm">
            <span className="text-xs font-mono font-medium tracking-tight">
              {formatDuration(session.duration_seconds)}
            </span>
          </div>

          {/* Status badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className={`text-xs uppercase tracking-wider ${statusColors[session.status]}`}>
              {session.status === "recording" && (
                <span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5 recording-pulse" />
              )}
              {session.status}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <h3 className="font-display text-lg tracking-wide text-foreground truncate group-hover:text-primary transition-colors">
            {session.title.toUpperCase()}
          </h3>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-wider">
            {session.game_name && (
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                {session.game_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
