import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Eye, Play, ArrowRight, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCommunityFeed, type CommunityPost } from "@/lib/community";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export function CommunityDiscoverySection() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommunityFeed({ limit: 5 })
      .then((data) => {
        // Sort by views descending to simulate "trending"
        const sorted = [...data].sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        setPosts(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <SectionHeader />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[260px] md:min-w-[280px] space-y-3 flex-shrink-0">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return (
      <section>
        <SectionHeader />
        <Card className="p-12 border-border/30 border-dashed text-center">
          <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-4" />
          <p className="font-display text-2xl mb-2">BE THE FIRST</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            No clips shared yet. Record a session and share your best moment with the community.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/community")}
            className="uppercase tracking-wider text-xs"
          >
            Go to Community
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        onViewAll={() => navigate("/community")}
        showViewAll={posts.length >= 3}
      />

      {/* Horizontal scroll container */}
      <div className="relative -mx-2">
        <div
          className={cn(
            "flex gap-4 px-2 pb-2 overflow-x-auto snap-x snap-mandatory",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50",
            // Hide scrollbar on mobile for cleaner look
            "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:bg-border/40 [&::-webkit-scrollbar-thumb]:rounded-full"
          )}
        >
          {posts.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.07 }}
              className="min-w-[260px] md:min-w-[280px] lg:min-w-[300px] max-w-[320px] flex-shrink-0 snap-start"
            >
              <CommunityClipCard post={post} rank={idx + 1} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  onViewAll,
  showViewAll,
}: {
  onViewAll?: () => void;
  showViewAll?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-vantage-teal" />
        <div>
          <h2 className="font-display text-2xl tracking-wide">FROM THE COMMUNITY</h2>
          <p className="text-xs text-muted-foreground tracking-wide mt-0.5">
            Popular right now
          </p>
        </div>
      </div>
      {showViewAll && (
        <Button
          variant="ghost"
          onClick={onViewAll}
          className="uppercase text-xs tracking-wider group"
        >
          View all
          <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

function CommunityClipCard({ post, rank }: { post: CommunityPost; rank: number }) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  // Determine a game tag from post tags or fallback
  const gameTag = post.tags?.find((t) => t.length > 0) || null;

  return (
    <Link to={`/community/${post.id}`} className="block">
      <Card
        className={cn(
          "group relative overflow-hidden border-border/30 bg-card/50",
          "hover:border-vantage-teal/50 transition-all duration-300",
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-vantage-teal/5"
        )}
      >
        {/* Thumbnail with overlay */}
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            {post.thumbnail_url ? (
              <img
                src={post.thumbnail_url}
                alt={post.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground/20" />
              </div>
            )}
          </AspectRatio>

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="h-11 w-11 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/50">
              <Play className="h-5 w-5 text-foreground ml-0.5" />
            </div>
          </div>

          {/* Duration badge */}
          {post.duration_seconds > 0 && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm text-[10px] font-mono-data text-foreground">
              {Math.floor(post.duration_seconds / 60)}:{String(post.duration_seconds % 60).padStart(2, "0")}
            </div>
          )}

          {/* Rank indicator for top 3 */}
          {rank <= 3 && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm">
              <Flame className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold text-foreground">#{rank}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
            {post.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.views_count || 0}
              </span>
              {gameTag && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-border/50"
                >
                  {gameTag}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/60">{timeAgo}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
