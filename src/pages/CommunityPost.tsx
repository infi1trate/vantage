import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Eye,
  MessageSquare,
  Share2,
  ArrowLeft,
  Lock,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  getCommunityPost,
  getCommunityPostByToken,
  getCommunityAnnotations,
  createCommunityAnnotation,
  deleteCommunityAnnotation,
  incrementViewCount,
  getShareableLink,
  CommunityPost,
  CommunityAnnotation,
} from "@/lib/community";
import { ReactionEmoji } from "@/lib/communityReactions";
import { useAuth } from "@/contexts/AuthContext";
import { useCommunityReactions } from "@/hooks/useCommunityReactions";
import { CommunityVideoPlayer } from "@/components/community/CommunityVideoPlayer";
import { CommunityAnnotationsPanel } from "@/components/community/CommunityAnnotationsPanel";

export default function CommunityPostPage() {
  const { postId, token } = useParams();
  const { user } = useAuth();
  
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [annotations, setAnnotations] = useState<CommunityAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Video state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Share
  const [copied, setCopied] = useState(false);

  const isAuthor = user?.id === post?.author_id;

  // Reactions hook
  const {
    reactions,
    addReaction,
    canReact,
  } = useCommunityReactions({
    postId: post?.id || "",
    enabled: !!post,
  });

  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        setError(null);
        
        let postData: CommunityPost | null = null;
        
        if (token) {
          postData = await getCommunityPostByToken(token);
        } else if (postId) {
          postData = await getCommunityPost(postId);
        }
        
        if (!postData) {
          setError("Post not found");
          return;
        }
        
        setPost(postData);
        
        // Increment view count
        incrementViewCount(postData.id).catch(console.error);
        
        // Load annotations if allowed or if author
        if (postData.allow_public_annotations || user?.id === postData.author_id) {
          const annotationsData = await getCommunityAnnotations(postData.id);
          setAnnotations(annotationsData);
        }
      } catch (err) {
        console.error("[CommunityPost] Load error:", err);
        setError("Failed to load post");
      } finally {
        setLoading(false);
      }
    }
    
    loadPost();
  }, [postId, token, user?.id]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  const handleSeekToAnnotation = useCallback((timestamp: number) => {
    // The video player handles its own seeking via the timeline
    setCurrentTime(timestamp);
  }, []);

  const handleAddAnnotation = async (content: string, timestamp: number) => {
    if (!post || !user) return;
    
    const annotation = await createCommunityAnnotation(
      post.id,
      user.id,
      timestamp,
      content
    );
    setAnnotations((prev) => 
      [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
    );
    toast.success("Note added");
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    await deleteCommunityAnnotation(annotationId);
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    toast.success("Note deleted");
  };

  const handleReact = useCallback(
    async (emoji: ReactionEmoji, timestamp: number) => {
      await addReaction(emoji, timestamp);
    },
    [addReaction]
  );

  const handleCopyLink = async () => {
    if (!post) return;
    const link = getShareableLink(post);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToX = () => {
    if (!post) return;
    const link = getShareableLink(post);
    const text = `Check out this gameplay clip: ${post.title}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    window.open(url, "_blank", "width=550,height=420");
  };

  const handleShareToDiscord = () => {
    if (!post) return;
    const link = getShareableLink(post);
    const message = `🎮 ${post.title}\n${link}`;
    navigator.clipboard.writeText(message);
    toast.success("Copied! Paste in Discord to share");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6">
          <div className="max-w-5xl mx-auto space-y-4">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-xl font-semibold mb-2">
            {error || "Post not found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            This post may have been deleted or you don't have permission to view it.
          </p>
          <Button asChild variant="outline">
            <Link to="/community">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Community
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const canAddAnnotation = post.allow_public_annotations || isAuthor;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-6">
        <div className="max-w-6xl mx-auto">
          {/* Back link */}
          <Link
            to="/community"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Community
          </Link>
          
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Video + Info Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Custom Video Player with reactions */}
              <CommunityVideoPlayer
                videoUrl={post.video_url}
                reactions={reactions}
                annotations={annotations}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onReact={handleReact}
                canReact={canReact}
              />
              
              {/* Title + Meta */}
              <div className="space-y-2">
                <h1 className="text-xl md:text-2xl font-semibold">{post.title}</h1>
                
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {post.views_count} views
                  </span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  {post.visibility !== "public" && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs">
                        {post.visibility === "unlisted" ? "Unlisted" : "Private"}
                      </Badge>
                    </>
                  )}
                </div>
                
                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Description */}
              {post.description && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-sm whitespace-pre-wrap">{post.description}</p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={handleShareToX}>
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Share on X
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShareToDiscord}>
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/>
                      </svg>
                      Copy for Discord
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Annotations Panel */}
              <CommunityAnnotationsPanel
                annotations={annotations}
                currentTime={currentTime}
                isAllowed={post.allow_public_annotations}
                isAuthor={isAuthor}
                currentUserId={user?.id}
                onAddAnnotation={handleAddAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
                onSeekToAnnotation={handleSeekToAnnotation}
              />
              
              {/* Comments Panel */}
              <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comments
                  </h3>
                  {!post.allow_comments && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Creator disabled comments
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                
                <div className="p-6 text-center">
                  {!post.allow_comments ? (
                    <>
                      <Lock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Creator has disabled comments for this post.
                      </p>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No comments yet.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
