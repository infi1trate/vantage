import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Video, Check, AlertCircle, Library, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface Session {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  game_name: string | null;
  created_at: string;
  annotation_count?: number;
}

interface SessionPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (session: Session) => void;
  selectedSessionId?: string | null;
}

export function SessionPickerModal({
  open,
  onOpenChange,
  onSelect,
  selectedSessionId,
}: SessionPickerModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: sessions, isLoading, error: queryError } = useQuery({
    queryKey: ["user-sessions-for-challenge", user?.id],
    queryFn: async () => {
      // Fetch sessions
      const { data, error } = await supabase
        .from("capture_sessions")
        .select("id, title, thumbnail_url, duration_seconds, game_name, created_at, status, video_url")
        .eq("user_id", user!.id)
        .eq("status", "ready")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!data || data.length === 0) return [] as Session[];

      // Fetch annotation counts per session
      const sessionIds = data.map(s => s.id);
      const { data: annotationCounts } = await supabase
        .from("annotations")
        .select("session_id")
        .in("session_id", sessionIds)
        .in("annotation_type", ["kill", "death", "highlight", "objective", "save"]);

      const countMap = new Map<string, number>();
      annotationCounts?.forEach(a => {
        countMap.set(a.session_id, (countMap.get(a.session_id) || 0) + 1);
      });

      // Sort: sessions with annotations first, then by date
      const enriched = data.map(s => ({
        ...s,
        annotation_count: countMap.get(s.id) || 0,
      })) as Session[];

      enriched.sort((a, b) => {
        const aHas = (a.annotation_count || 0) > 0 ? 1 : 0;
        const bHas = (b.annotation_count || 0) > 0 ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas; // Annotated first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return enriched;
    },
    enabled: !!user?.id && open,
  });

  const filteredSessions = sessions?.filter((session) =>
    session.title.toLowerCase().includes(search.toLowerCase()) ||
    session.game_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Select a Recording
          </DialogTitle>
          <DialogDescription>
            Choose a clip from your library to submit
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sessions Grid */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : !filteredSessions || filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-3">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium text-foreground">No eligible recordings found</p>
              <div className="text-xs text-muted-foreground max-w-xs mx-auto space-y-1">
                <p>Recordings must meet these criteria:</p>
                <ul className="text-left list-disc list-inside space-y-0.5">
                  <li>Status: <strong>Ready</strong> (fully processed)</li>
                  <li>Not deleted</li>
                </ul>
                {queryError && (
                  <p className="text-destructive mt-2">Error: {queryError.message}</p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild className="mt-3">
                <Link to="/library">
                  <Library className="h-4 w-4 mr-2" />
                  Go to Library
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelect(session);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "group relative text-left rounded-lg overflow-hidden border transition-all",
                    "hover:border-primary hover:ring-2 hover:ring-primary/20",
                    selectedSessionId === session.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border/50"
                  )}
                >
                  <AspectRatio ratio={16 / 9}>
                    {session.thumbnail_url ? (
                      <img
                        src={session.thumbnail_url}
                        alt={session.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </AspectRatio>

                  {/* Duration */}
                  <div className="absolute bottom-12 right-2 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
                    {formatDuration(session.duration_seconds)}
                  </div>

                  {/* Selected Check */}
                  {selectedSessionId === session.id && (
                    <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors flex-1">
                        {session.title}
                      </p>
                      {(session.annotation_count || 0) > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 gap-0.5">
                          <Tag className="h-2.5 w-2.5" />
                          {session.annotation_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
