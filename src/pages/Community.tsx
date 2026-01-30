import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Clock,
  Eye,
  MessageSquare,
  Search,
  TrendingUp,
  Calendar,
  Gamepad2,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { getCommunityFeed, CommunityPost } from "@/lib/community";
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

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  return (
    <Link
      to={`/community/${post.id}`}
      className="group block rounded-xl overflow-hidden bg-card border border-border/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted/50 overflow-hidden">
        {post.thumbnail_url ? (
          <img
            src={post.thumbnail_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
          {formatDuration(post.duration_seconds)}
        </div>
        
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
          <div className="p-3 rounded-full bg-primary/90 text-primary-foreground opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all">
            <Play className="h-6 w-6" fill="currentColor" />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        
        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
            {post.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{post.tags.length - 3}
              </span>
            )}
          </div>
        )}
        
        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViews(post.views_count)}
            </span>
            {post.allow_comments && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
              </span>
            )}
          </div>
          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  );
}

function PostCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border/50">
      <Skeleton className="aspect-video w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");

  useEffect(() => {
    async function loadPosts() {
      try {
        setLoading(true);
        const data = await getCommunityFeed({ limit: 50 });
        setPosts(data);
      } catch (error) {
        console.error("[Community] Failed to load posts:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  // Filter and sort posts
  const filteredPosts = posts
    .filter((post) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        post.title.toLowerCase().includes(query) ||
        post.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === "popular") {
        return b.views_count - a.views_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-6 space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="font-display text-4xl md:text-5xl tracking-wider">
              COMMUNITY
            </h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Discover gameplay moments, learn from others, and share your best clips with the Vantage community.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts or tags..."
              className="pl-9 bg-muted/30"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[140px] bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Recent
                  </span>
                </SelectItem>
                <SelectItem value="popular">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Popular
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <div>
              <h3 className="font-semibold text-lg">No posts yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery
                  ? "No posts match your search. Try different keywords."
                  : "Be the first to share your gameplay with the community!"}
              </p>
            </div>
            {user && !searchQuery && (
              <Button asChild>
                <Link to="/library">
                  <Play className="h-4 w-4 mr-2" />
                  Browse Your Sessions
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPosts.map((post) => (
              <CommunityPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
