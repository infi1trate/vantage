import { SocialCommentsPanel } from "@/components/social/SocialCommentsPanel";

interface CommentsSectionProps {
  sessionId: string;
  currentTime: number;
  onSeekTo: (time: number) => void;
}

export function CommentsSection({
  sessionId,
  currentTime,
  onSeekTo,
}: CommentsSectionProps) {
  return (
    <div className="h-full">
      <SocialCommentsPanel
        sessionId={sessionId}
        currentTime={currentTime}
        onSeekTo={onSeekTo}
      />
    </div>
  );
}
