import { useState, useMemo, memo, useCallback } from "react";
import { Annotation, VoiceNote } from "@/lib/captures";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Smile,
  MessageCircle,
  Mic,
  ChevronRight,
  Trash2,
  Lock,
  Globe,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReactionsSectionProps {
  annotations: Annotation[];
  voiceNotes: VoiceNote[];
  currentTime: number;
  onAnnotationClick?: (annotation: Annotation) => void;
  onVoiceNoteClick?: (voiceNote: VoiceNote) => void;
  onMarkerClick: (time: number) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onCreateReaction?: (type: "emoji" | "text" | "voice", content: string, timestamp: number) => void;
  onOpenVoice?: () => void;
  onVisibilityChange?: (id: string, isPublic: boolean) => void;
  isSessionShared?: boolean;
}

// Quick emoji palette - playful but not overwhelming
const QUICK_EMOJIS = ["🔥", "💀", "😤", "🎯", "💪", "😂", "🤯", "👀"];

// Reaction type configuration
const REACTION_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bg: string 
}> = {
  emoji: { label: "Emoji", icon: Smile, color: "text-vantage-warning", bg: "bg-vantage-warning/10" },
  text: { label: "Thought", icon: MessageCircle, color: "text-accent", bg: "bg-accent/10" },
  voice: { label: "Voice", icon: Mic, color: "text-primary", bg: "bg-primary/10" },
  marker: { label: "Marker", icon: MessageCircle, color: "text-muted-foreground", bg: "bg-muted/20" },
  note: { label: "Thought", icon: MessageCircle, color: "text-accent", bg: "bg-accent/10" },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Combined reaction item type
type ReactionItem = {
  id: string;
  type: "annotation" | "voice";
  time: number;
  endTime?: number;
  reactionType: "emoji" | "text" | "voice";
  content: string;
  isPublic: boolean;
  data: Annotation | VoiceNote;
};

// Memoized reaction row - scannable and calm
const ReactionRow = memo(function ReactionRow({
  item,
  isActive,
  onClick,
  onDelete,
  onVisibilityToggle,
  showVisibilityControl,
}: {
  item: ReactionItem;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onVisibilityToggle?: (isPublic: boolean) => void;
  showVisibilityControl?: boolean;
}) {
  const config = REACTION_CONFIG[item.reactionType] || REACTION_CONFIG.text;
  const Icon = config.icon;
  const isEmoji = item.reactionType === "emoji";
  
  const handleVisibilityToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onVisibilityToggle?.(!item.isPublic);
  }, [item.isPublic, onVisibilityToggle]);
  
  return (
    <button
      className={cn(
        // Generous tap target for mobile
        "w-full flex items-center gap-3 p-3 min-h-14 rounded-xl text-left transition-all group touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isActive 
          ? "bg-primary/10 border border-primary/30" 
          : "hover:bg-muted/30 active:bg-muted/40 border border-transparent"
      )}
      onClick={onClick}
    >
      {/* Icon or Emoji */}
      <div className={cn(
        "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
        isActive ? "bg-primary/20" : config.bg
      )}>
        {isEmoji ? (
          <span className="text-xl">{item.content}</span>
        ) : (
          <Icon className={cn(
            "h-5 w-5",
            isActive ? "text-primary" : config.color
          )} />
        )}
      </div>
      
      {/* Content + Timestamp */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono tabular-nums text-muted-foreground">
            {formatTime(item.time)}
          </span>
          {/* Visibility indicator/toggle */}
          {showVisibilityControl && onVisibilityToggle ? (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleVisibilityToggle}
                  className={cn(
                    // Ensure 44px minimum touch target for accessibility
                    "p-2 -m-1.5 rounded-lg transition-colors",
                    "touch-manipulation",
                    item.isPublic 
                      ? "text-primary hover:text-primary/80 hover:bg-primary/10" 
                      : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30"
                  )}
                  aria-label={item.isPublic ? "Public - click to make private" : "Private - click to make public"}
                >
                  {item.isPublic ? (
                    <Globe className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {item.isPublic ? "Public – visible in Community" : "Private – only you can see"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Lock className="h-3 w-3 text-muted-foreground/50" aria-label="Private" />
          )}
        </div>
        {!isEmoji && item.content && (
          <p className={cn(
            "text-sm truncate mt-0.5",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}>
            {item.content}
          </p>
        )}
      </div>
      
      {/* Delete action - visible on mobile when active, hover-reveal on desktop */}
      <div className="shrink-0 flex items-center gap-1">
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 transition-opacity touch-manipulation",
              isActive 
                ? "opacity-100" 
                : "opacity-0 group-hover:opacity-100 sm:opacity-0"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete reaction"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
        <ChevronRight className={cn(
          "h-4 w-4 transition-opacity hidden sm:block",
          isActive ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-40 text-muted-foreground"
        )} />
      </div>
    </button>
  );
});

// Quick reaction input bar - thumb-friendly
const QuickReactionBar = memo(function QuickReactionBar({
  currentTime,
  onCreateReaction,
  onOpenVoice,
}: {
  currentTime: number;
  onCreateReaction?: (type: "emoji" | "text", content: string, timestamp: number) => void;
  onOpenVoice?: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "emoji" | "text">("idle");
  const [textInput, setTextInput] = useState("");
  
  const handleEmojiSelect = useCallback((emoji: string) => {
    onCreateReaction?.("emoji", emoji, currentTime);
    setMode("idle");
  }, [currentTime, onCreateReaction]);
  
  const handleTextSubmit = useCallback(() => {
    if (textInput.trim()) {
      onCreateReaction?.("text", textInput.trim(), currentTime);
      setTextInput("");
      setMode("idle");
    }
  }, [currentTime, textInput, onCreateReaction]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
    if (e.key === "Escape") {
      setMode("idle");
      setTextInput("");
    }
  }, [handleTextSubmit]);

  if (mode === "emoji") {
    return (
      <div className="p-3 border-t border-border/30 bg-card/50">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-muted-foreground mr-auto">
            React at {formatTime(currentTime)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMode("idle")}
          >
            Cancel
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className="w-11 h-11 min-w-11 text-xl rounded-lg hover:bg-muted/50 active:scale-95 transition-all flex items-center justify-center touch-manipulation"
              onClick={() => handleEmojiSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className="p-3 border-t border-border/30 bg-card/50">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-muted-foreground mr-auto">
            Quick thought at {formatTime(currentTime)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setMode("idle"); setTextInput(""); }}
          >
            Cancel
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What happened here..."
            className="h-10 text-sm"
            maxLength={140}
            autoFocus
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleTextSubmit}
            disabled={!textInput.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Idle mode - show quick action buttons
  return (
    <div className="p-3 border-t border-border/30 bg-card/50">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 gap-2"
          onClick={() => setMode("emoji")}
        >
          <Smile className="h-4 w-4" />
          <span className="hidden sm:inline">Emoji</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 gap-2"
          onClick={() => setMode("text")}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Thought</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 gap-2"
          onClick={onOpenVoice}
        >
          <Mic className="h-4 w-4" />
          <span className="hidden sm:inline">Voice</span>
        </Button>
      </div>
    </div>
  );
});

export const ReactionsSection = memo(function ReactionsSection({
  annotations,
  voiceNotes,
  currentTime,
  onAnnotationClick,
  onVoiceNoteClick,
  onMarkerClick,
  onAnnotationDelete,
  onCreateReaction,
  onOpenVoice,
  onVisibilityChange,
  isSessionShared = false,
}: ReactionsSectionProps) {
  // Convert annotations and voice notes to reaction items
  const reactions = useMemo<ReactionItem[]>(() => {
    const items: ReactionItem[] = [];
    
    // Process annotations
    annotations.forEach(a => {
      // Determine reaction type based on content
      let reactionType: "emoji" | "text" | "voice" = "text";
      let content = a.title || a.content || "";
      
      // Check if it's an emoji-only reaction (content is only emoji characters)
      const emojiOnlyPattern = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;
      if (content.length <= 8 && emojiOnlyPattern.test(content)) {
        reactionType = "emoji";
      }
      
      items.push({
        id: a.id,
        type: "annotation",
        time: a.timestamp_seconds,
        endTime: a.end_timestamp_seconds || undefined,
        reactionType,
        content,
        isPublic: a.visibility === "public",
        data: a,
      });
    });
    
    // Process voice notes
    voiceNotes.forEach(v => {
      items.push({
        id: v.id,
        type: "voice",
        time: v.timestamp_seconds,
        reactionType: "voice",
        content: v.transcription || "Voice reaction",
        isPublic: !v.is_private,
        data: v,
      });
    });
    
    return items.sort((a, b) => a.time - b.time);
  }, [annotations, voiceNotes]);
  
  // Count public reactions
  const publicCount = useMemo(() => 
    reactions.filter(r => r.isPublic).length, 
    [reactions]
  );

  // Find active reaction based on current playback time
  const activeReactionId = useMemo(() => {
    const tolerance = 0.5;
    const active = reactions.find(item => {
      if (item.endTime) {
        return currentTime >= item.time - tolerance && currentTime <= item.endTime + tolerance;
      }
      return Math.abs(currentTime - item.time) <= tolerance;
    });
    return active?.id;
  }, [reactions, currentTime]);

  const handleReactionClick = useCallback((item: ReactionItem) => {
    if (item.type === "annotation") {
      const annotation = item.data as Annotation;
      onAnnotationClick?.(annotation) ?? onMarkerClick(annotation.timestamp_seconds);
    } else {
      const voiceNote = item.data as VoiceNote;
      onVoiceNoteClick?.(voiceNote) ?? onMarkerClick(voiceNote.timestamp_seconds);
    }
  }, [onAnnotationClick, onVoiceNoteClick, onMarkerClick]);

  const handleVisibilityChange = useCallback((itemId: string, isPublic: boolean) => {
    onVisibilityChange?.(itemId, isPublic);
  }, [onVisibilityChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Reactions list */}
      {reactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <Smile className="h-7 w-7 text-accent/50" />
          </div>
          <h4 className="font-semibold mb-2">No reactions yet</h4>
          <p className="text-sm text-muted-foreground max-w-xs mb-1">
            Add emojis, quick thoughts, or voice notes as you watch.
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <Lock className="h-3 w-3" />
            <span>All reactions are private by default</span>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Privacy status indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 py-2 mb-1">
              {isSessionShared && publicCount > 0 ? (
                <>
                  <Globe className="h-3 w-3 text-primary/60" />
                  <span>{publicCount} public</span>
                  <span className="text-border">•</span>
                  <Lock className="h-3 w-3" />
                  <span>{reactions.length - publicCount} private</span>
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Your private reactions</span>
                </>
              )}
            </div>
            
            <div className="space-y-1">
              {reactions.map((item) => (
                <ReactionRow
                  key={item.id}
                  item={item}
                  isActive={item.id === activeReactionId}
                  onClick={() => handleReactionClick(item)}
                  onDelete={onAnnotationDelete ? () => onAnnotationDelete(item.id) : undefined}
                  onVisibilityToggle={
                    isSessionShared && onVisibilityChange 
                      ? (isPublic) => handleVisibilityChange(item.id, isPublic) 
                      : undefined
                  }
                  showVisibilityControl={isSessionShared}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Quick reaction input bar */}
      <QuickReactionBar
        currentTime={currentTime}
        onCreateReaction={onCreateReaction}
        onOpenVoice={onOpenVoice}
      />
    </div>
  );
});
