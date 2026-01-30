import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  Clock,
  Eye,
  MessageSquare,
  Send,
  Share2,
  Flag,
  ArrowLeft,
  Lock,
  AlertCircle,
  Copy,
  Check,
  User,
  Pencil,
  Trash2,
  MoreVertical,
  Maximize2,
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
import { useAuth } from "@/contexts/AuthContext";

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function CommunityPostPage() {
  const { postId, token } = useParams();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [annotations, setAnnotations] = useState<CommunityAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Annotation input
  const [annotationInput, setAnnotationInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Share
  const [copied, setCopied] = useState(false);

  const isAuthor = user?.id === post?.author_id;

  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        setError(null);
        
        let postData: CommunityPost | null = null;
        
        if (token) {
          // Load by share token
          postData = await getCommunityPostByToken(token);
        } else if (postId) {
          // Load by ID
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeekToAnnotation = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
    }
  };

  const handleAddAnnotation = async () => {
    if (!post || !user || !annotationInput.trim()) return;
    
    try {
      setIsSubmitting(true);
      const annotation = await createCommunityAnnotation(
        post.id,
        user.id,
        currentTime,
        annotationInput.trim()
      );
      setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setAnnotationInput("");
      toast.success("Annotation added");
    } catch (err) {
      console.error("[CommunityPost] Add annotation error:", err);
      toast.error("Failed to add annotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    try {
      await deleteCommunityAnnotation(annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      toast.success("Annotation deleted");
    } catch (err) {
      console.error("[CommunityPost] Delete annotation error:", err);
      toast.error("Failed to delete annotation");
    }
  };

  const handleCopyLink = async () => {
    if (!post) return;
    const link = getShareableLink(post);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
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
              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                {post.video_url ? (
                  <video
                    ref={videoRef}
                    src={post.video_url}
                    className="w-full h-full object-contain"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    controls
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <p>Video not available</p>
                  </div>
                )}
              </div>
              
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
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  {copied ? "Copied" : "Share"}
                </Button>
              </div>
            </div>
            
            {/* Sidebar - Annotations/Comments */}
            <div className="lg:col-span-1 space-y-4">
              {/* Annotations Panel */}
              <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Annotations
                  </h3>
                  {!post.allow_public_annotations && !isAuthor && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Creator disabled public annotations
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                
                <ScrollArea className="h-[300px]">
                  {!post.allow_public_annotations && !isAuthor ? (
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
                        <div
                          key={annotation.id}
                          className="p-3 hover:bg-muted/20 transition-colors group"
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => handleSeekToAnnotation(annotation.timestamp_seconds)}
                              className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono shrink-0 hover:bg-primary/20 transition-colors"
                            >
                              {formatTimestamp(annotation.timestamp_seconds)}
                            </button>
                            <p className="text-sm flex-1">{annotation.content}</p>
                            {(user?.id === annotation.user_id || isAuthor) && (
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
                                    onClick={() => handleDeleteAnnotation(annotation.id)}
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
                      ))}
                    </div>
                  )}
                </ScrollArea>
                
                {/* Add annotation input */}
                {canAddAnnotation && user && (
                  <div className="p-3 border-t border-border/50">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input
                          value={annotationInput}
                          onChange={(e) => setAnnotationInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddAnnotation()}
                          placeholder={`Add note at ${formatTimestamp(currentTime)}...`}
                          className="pr-10 bg-muted/30 text-sm"
                          disabled={isSubmitting}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                          {formatTimestamp(currentTime)}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        onClick={handleAddAnnotation}
                        disabled={!annotationInput.trim() || isSubmitting}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
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
