import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Pencil,
  Mic,
  Play,
  Clock,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SocialCommentsPanel } from "./SocialCommentsPanel";
import { Annotation, VoiceNote } from "@/lib/captures";

interface ReviewerFeedbackPanelProps {
  sessionId: string;
  currentTime: number;
  isOwner: boolean;
  permission: "view" | "annotate" | "edit";
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  onSeekTo: (time: number) => void;
  onStartDrawing: () => void;
  onStartVoiceRecording: () => void;
}

export function ReviewerFeedbackPanel({
  sessionId,
  currentTime,
  isOwner,
  permission,
  annotations,
  voiceNotes,
  onSeekTo,
  onStartDrawing,
  onStartVoiceRecording,
}: ReviewerFeedbackPanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("comments");

  const canAnnotate = permission === "annotate" || permission === "edit" || isOwner;

  // Filter feedback by type - all feedback is timestamped
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get feedback near current time (within 5 seconds)
  const nearbyAnnotations = annotations.filter(
    (a) => Math.abs(a.timestamp_seconds - currentTime) < 5
  );
  const nearbyVoiceNotes = voiceNotes.filter(
    (v) => Math.abs(v.timestamp_seconds - currentTime) < 5
  );

  return (
    <Card className="flex flex-col h-full bg-card border-border/50">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Reviewer Feedback
          </h3>
          <Badge variant="outline" className="text-xs">
            {isOwner ? "Owner" : permission === "edit" ? "Editor" : permission === "annotate" ? "Reviewer" : "Viewer"}
          </Badge>
        </div>

        {/* Current time context */}
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Currently at {formatTime(currentTime)}</span>
          {(nearbyAnnotations.length > 0 || nearbyVoiceNotes.length > 0) && (
            <Badge variant="secondary" className="text-xs">
              {nearbyAnnotations.length + nearbyVoiceNotes.length} nearby
            </Badge>
          )}
        </div>
      </div>

      {/* Quick action buttons for reviewers */}
      {canAnnotate && (
        <div className="p-4 border-b border-border/50 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">
            Add feedback at {formatTime(currentTime)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2"
              onClick={() => setActiveTab("comments")}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Comment</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2"
              onClick={onStartDrawing}
            >
              <Pencil className="h-4 w-4" />
              <span className="text-xs">Draw</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2"
              onClick={onStartVoiceRecording}
            >
              <Mic className="h-4 w-4" />
              <span className="text-xs">Voice</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
          <TabsTrigger value="comments" className="text-xs gap-1">
            <MessageSquare className="h-3 w-3" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="drawings" className="text-xs gap-1">
            <Pencil className="h-3 w-3" />
            Drawings
          </TabsTrigger>
          <TabsTrigger value="voice" className="text-xs gap-1">
            <Mic className="h-3 w-3" />
            Voice
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="comments" className="h-full mt-0">
            <SocialCommentsPanel
              sessionId={sessionId}
              currentTime={currentTime}
              onSeekTo={onSeekTo}
              onStartDrawing={onStartDrawing}
              onStartVoiceNote={onStartVoiceRecording}
            />
          </TabsContent>

          <TabsContent value="drawings" className="h-full mt-0 p-4">
            <DrawingsTimeline
              annotations={annotations.filter(a => a.annotation_type === "highlight" || a.content?.includes("[drawing]"))}
              onSeekTo={onSeekTo}
            />
          </TabsContent>

          <TabsContent value="voice" className="h-full mt-0 p-4">
            <VoiceNotesTimeline
              voiceNotes={voiceNotes}
              currentTime={currentTime}
              onSeekTo={onSeekTo}
            />
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

// Drawings timeline sub-component
function DrawingsTimeline({
  annotations,
  onSeekTo,
}: {
  annotations: Annotation[];
  onSeekTo: (time: number) => void;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (annotations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Pencil className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No drawings yet</p>
        <p className="text-xs">Use the draw button to annotate frames</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {annotations.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
          onClick={() => onSeekTo(a.timestamp_seconds)}
        >
          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {a.title || "Drawing annotation"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(a.timestamp_seconds)}
            </p>
          </div>
          <Play className="h-4 w-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

// Voice notes timeline sub-component
function VoiceNotesTimeline({
  voiceNotes,
  currentTime,
  onSeekTo,
}: {
  voiceNotes: VoiceNote[];
  currentTime: number;
  onSeekTo: (time: number) => void;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (voiceNotes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No voice notes yet</p>
        <p className="text-xs">Record voice feedback at any timestamp</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {voiceNotes.map((v) => {
        const isNear = Math.abs(v.timestamp_seconds - currentTime) < 3;
        return (
          <div
            key={v.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
              isNear ? "bg-primary/20 border border-primary/30" : "bg-muted/50 hover:bg-muted"
            )}
            onClick={() => onSeekTo(v.timestamp_seconds)}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isNear ? "bg-primary" : "bg-accent/20"
            )}>
              <Mic className={cn("h-4 w-4", isNear ? "text-primary-foreground" : "text-accent")} />
            </div>
            <div className="flex-1 min-w-0">
              {v.transcription ? (
                <p className="text-sm truncate">{v.transcription}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No transcription</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatTime(v.timestamp_seconds)}</span>
                <span>•</span>
                <span>{v.duration_seconds.toFixed(1)}s</span>
              </div>
            </div>
            <Play className={cn("h-4 w-4", isNear ? "text-primary" : "text-muted-foreground")} />
          </div>
        );
      })}
    </div>
  );
}
