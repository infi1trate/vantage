import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  Clock,
  Send,
  Pin,
  Reply,
  ThumbsUp,
  Heart,
  Flame,
  Check,
  MoreHorizontal,
  Mic,
  Pencil,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createSocialComment,
  getSocialComments,
  addReaction,
  removeReaction,
  SocialComment,
  ReactionType,
} from "@/lib/captures";
import { formatDistanceToNow } from "date-fns";

interface SocialCommentsPanelProps {
  sessionId: string;
  currentTime: number;
  onSeekTo: (time: number) => void;
  onStartDrawing?: () => void;
  onStartVoiceNote?: () => void;
}

const REACTIONS: { type: ReactionType; icon: typeof ThumbsUp; label: string }[] = [
  { type: "like", icon: ThumbsUp, label: "Like" },
  { type: "helpful", icon: Heart, label: "Helpful" },
  { type: "fire", icon: Flame, label: "Fire" },
  { type: "agree", icon: Check, label: "Agree" },
];

export function SocialCommentsPanel({
  sessionId,
  currentTime,
  onSeekTo,
  onStartDrawing,
  onStartVoiceNote,
}: SocialCommentsPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<SocialComment | null>(null);
  const [anchorToTimestamp, setAnchorToTimestamp] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
  }, [sessionId]);

  const loadComments = async () => {
    try {
      const data = await getSocialComments(sessionId);
      setComments(data);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;

    setSubmitting(true);
    try {
      const newComment = await createSocialComment(
        sessionId,
        user.id,
        content.trim(),
        anchorToTimestamp ? currentTime : undefined,
        replyTo?.id
      );
      setComments((prev) => [...prev, newComment]);
      setContent("");
      setReplyTo(null);
      toast.success("Comment added");
    } catch (error) {
      console.error("Error creating comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (commentId: string, reactionType: ReactionType) => {
    if (!user) return;

    try {
      // Check if user already reacted
      const comment = comments.find((c) => c.id === commentId);
      // For simplicity, toggle reaction
      await addReaction(commentId, user.id, reactionType);
      
      // Update local state
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            const counts = { ...c.reaction_counts };
            counts[reactionType] = (counts[reactionType] || 0) + 1;
            return { ...c, reaction_counts: counts };
          }
          return c;
        })
      );
    } catch (error) {
      // Might be duplicate, ignore
      console.log("Reaction already exists or error:", error);
    }
  };

  const handleReply = (comment: SocialComment) => {
    setReplyTo(comment);
    textareaRef.current?.focus();
  };

  // Group comments by parent (threading)
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  return (
    <Card className="flex flex-col h-full bg-card border-border/50">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs">Be the first to leave feedback!</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {topLevelComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                replies={getReplies(comment.id)}
                onSeekTo={onSeekTo}
                onReply={handleReply}
                onReaction={handleReaction}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Replying to comment at{" "}
            {replyTo.timestamp_seconds !== null
              ? formatTime(replyTo.timestamp_seconds)
              : "general"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setReplyTo(null)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-border/50 space-y-3">
        {/* Timestamp anchor toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant={anchorToTimestamp ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAnchorToTimestamp(!anchorToTimestamp)}
          >
            <Pin className={cn("h-3 w-3", anchorToTimestamp && "text-primary-foreground")} />
            {anchorToTimestamp ? `Pinned to ${formatTime(currentTime)}` : "Not pinned"}
          </Button>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onStartDrawing}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draw on frame</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onStartVoiceNote}
                >
                  <Mic className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Record voice note</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Text input */}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={
              anchorToTimestamp
                ? `Comment on ${formatTime(currentTime)}...`
                : "Add a general comment..."
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                handleSubmit();
              }
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            size="icon"
            className="h-[60px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Press ⌘+Enter to submit
        </p>
      </div>
    </Card>
  );
}

// Comment thread component
interface CommentThreadProps {
  comment: SocialComment;
  replies: SocialComment[];
  onSeekTo: (time: number) => void;
  onReply: (comment: SocialComment) => void;
  onReaction: (commentId: string, type: ReactionType) => void;
}

function CommentThread({
  comment,
  replies,
  onSeekTo,
  onReply,
  onReaction,
}: CommentThreadProps) {
  return (
    <div className="space-y-2">
      <CommentItem
        comment={comment}
        onSeekTo={onSeekTo}
        onReply={onReply}
        onReaction={onReaction}
      />
      {replies.length > 0 && (
        <div className="ml-8 pl-4 border-l-2 border-border/50 space-y-2">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onSeekTo={onSeekTo}
              onReply={onReply}
              onReaction={onReaction}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Single comment item
interface CommentItemProps {
  comment: SocialComment;
  onSeekTo: (time: number) => void;
  onReply: (comment: SocialComment) => void;
  onReaction: (commentId: string, type: ReactionType) => void;
  isReply?: boolean;
}

function CommentItem({
  comment,
  onSeekTo,
  onReply,
  onReaction,
  isReply = false,
}: CommentItemProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "group rounded-lg p-3 transition-colors",
        isReply ? "bg-muted/30" : "bg-muted/50"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {comment.user_id.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              User {comment.user_id.slice(0, 8)}
            </span>
            {comment.timestamp_seconds !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-xs gap-1 text-primary"
                onClick={() => onSeekTo(comment.timestamp_seconds!)}
              >
                <Clock className="h-3 w-3" />
                {formatTime(comment.timestamp_seconds)}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Content */}
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {REACTIONS.map(({ type, icon: Icon, label }) => {
              const count = comment.reaction_counts?.[type] || 0;
              return (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-xs gap-1",
                        count > 0 && "text-primary"
                      )}
                      onClick={() => onReaction(comment.id, type)}
                    >
                      <Icon className="h-3 w-3" />
                      {count > 0 && count}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => onReply(comment)}
            >
              <Reply className="h-3 w-3" />
              Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
