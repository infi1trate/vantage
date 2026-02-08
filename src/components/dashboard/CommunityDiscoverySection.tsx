import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Eye, MessageCircle, ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCommunityFeed, type CommunityPost } from "@/lib/community";
import { motion } from "framer-motion";

export function CommunityDiscoverySection() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommunityFeed({ limit: 4 })
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <SectionHeader />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
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
        <Card className="p-10 border-border/30 border-dashed text-center">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-display text-xl mb-1">NO COMMUNITY POSTS YET</p>
          <p className="text-sm text-muted-foreground">
            Be the first to share a clip with the community.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader onViewAll={() => navigate("/community")} showViewAll={posts.length >= 4} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.08 }}
          >
            <CommunityPostCard post={post} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ onViewAll, showViewAll }: { onViewAll?: () => void; showViewAll?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-vantage-teal" />
        <h2 className="font-display text-2xl tracking-wide">FROM THE COMMUNITY</h2>
      </div>
      {showViewAll && (
        <Button variant="ghost" onClick={onViewAll} className="uppercase text-xs tracking-wider group">
          View all
          <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  return (
    <Link to={`/community/${post.id}`}>
      <Card className="group overflow-hidden border-border/30 bg-card/50 hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5">
        <AspectRatio ratio={16 / 9}>
          {post.thumbnail_url ? (
            <img
              src={post.thumbnail_url}
              alt={post.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </AspectRatio>

        <div className="p-3 space-y-2">
          <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.views_count || 0}
            </span>
            {post.tags && post.tags.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {post.tags[0]}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
