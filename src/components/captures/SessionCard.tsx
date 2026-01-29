import { CaptureSession } from "@/lib/captures";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, Calendar, Gamepad2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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
    recording: "bg-red-500/20 text-red-400 border-red-500/30",
    processing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    ready: "bg-green-500/20 text-green-400 border-green-500/30",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
  };

  return (
    <Link to={`/session/${session.id}`}>
      <Card className="group relative overflow-hidden bg-card border-border/50 hover:border-primary/50 transition-all duration-300 card-hover cursor-pointer">
        {/* Thumbnail */}
        <div className="aspect-video relative bg-muted/50 overflow-hidden">
          {session.thumbnail_url ? (
            <img 
              src={session.thumbnail_url} 
              alt={session.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-card">
              <Gamepad2 className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="p-4 rounded-full bg-primary/90 glow-primary">
              <Play className="h-8 w-8 text-primary-foreground" fill="currentColor" />
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm">
            <span className="text-xs font-mono-data font-medium">
              {formatDuration(session.duration_seconds)}
            </span>
          </div>

          {/* Status badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className={statusColors[session.status]}>
              {session.status === "recording" && (
                <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 recording-pulse" />
              )}
              {session.status}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {session.title}
          </h3>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
