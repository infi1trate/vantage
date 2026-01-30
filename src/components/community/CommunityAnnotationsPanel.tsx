import { useState } from "react";
import { cn } from "@/lib/utils";
import { CommunityAnnotation } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  Lock,
  MoreVertical,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";

interface CommunityAnnotationsPanelProps {
  annotations: CommunityAnnotation[];
  currentTime: number;
  isAllowed: boolean;
  isAuthor: boolean;
  currentUserId?: string;
  onAddAnnotation: (content: string, timestamp: number) => Promise<void>;
  onDeleteAnnotation: (annotationId: string) => Promise<void>;
  onSeekToAnnotation: (timestamp: number) => void;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CommunityAnnotationsPanel({
  annotations,
  currentTime,
  isAllowed,
  isAuthor,
  currentUserId,
  onAddAnnotation,
  onDeleteAnnotation,
  onSeekToAnnotation,
  className,
}: CommunityAnnotationsPanelProps) {
  const [annotationInput, setAnnotationInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAddAnnotation = isAllowed || isAuthor;

  const handleSubmit = async () => {
    if (!annotationInput.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddAnnotation(annotationInput.trim(), currentTime);
      setAnnotationInput("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("rounded-xl bg-card border border-border/50 overflow-hidden", className)}>
      {/* Header */}
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Annotations
        </h3>
        {!isAllowed && !isAuthor && (
          <Tooltip>
            <TooltipTrigger>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Creator disabled public annotations</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Annotations list */}
      <ScrollArea className="h-[300px]">
        {!isAllowed && !isAuthor ? (
          <div className="p-6 text-center">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              Creator has disabled annotations for this post.
            </p>
          </div>
        ) : annotations.length === 0 ? (
          <div className="p-6 text-center">
            <Pencil className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              No annotations yet.
              {canAddAnnotation && " Add the first one!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {annotations.map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                annotation={annotation}
                canDelete={currentUserId === annotation.user_id || isAuthor}
                onSeek={onSeekToAnnotation}
                onDelete={onDeleteAnnotation}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      {canAddAnnotation && currentUserId && (
        <div className="p-3 border-t border-border/50">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={annotationInput}
                onChange={(e) => setAnnotationInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Add note at ${formatTimestamp(currentTime)}...`}
                className="pr-16 bg-muted/30 text-sm"
                disabled={isSubmitting}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                <Clock className="h-3 w-3" />
                {formatTimestamp(currentTime)}
              </div>
            </div>
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!annotationInput.trim() || isSubmitting}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AnnotationItemProps {
  annotation: CommunityAnnotation;
  canDelete: boolean;
  onSeek: (timestamp: number) => void;
  onDelete: (id: string) => Promise<void>;
}

function AnnotationItem({
  annotation,
  canDelete,
  onSeek,
  onDelete,
}: AnnotationItemProps) {
  return (
    <div className="p-3 hover:bg-muted/20 transition-colors group">
      <div className="flex items-start gap-2">
        <button
          onClick={() => onSeek(annotation.timestamp_seconds)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono shrink-0 hover:bg-primary/20 transition-colors"
        >
          <Clock className="h-2.5 w-2.5" />
          {formatTimestamp(annotation.timestamp_seconds)}
        </button>
        <p className="text-sm flex-1">{annotation.content}</p>
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(annotation.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {annotation.tags.length > 0 && (
        <div className="flex gap-1 mt-1 ml-10">
          {annotation.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
