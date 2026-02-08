import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, ArrowRight } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { useChallenges } from "@/hooks/useChallenges";
import { motion } from "framer-motion";

export function ChallengesEngagementSection() {
  const navigate = useNavigate();
  const { data: challenges, isLoading } = useChallenges(["active", "draft"]);

  // Show at most 3 challenges
  const displayChallenges = (challenges || []).slice(0, 3);

  if (isLoading) {
    return (
      <section>
        <SectionHeader />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (displayChallenges.length === 0) {
    return (
      <section>
        <SectionHeader />
        <Card className="p-10 border-border/30 border-dashed text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-display text-xl mb-1">NO ACTIVE CHALLENGES</p>
          <p className="text-sm text-muted-foreground mb-4">
            Check back soon — new challenges drop regularly.
          </p>
          <Button variant="outline" onClick={() => navigate("/challenges")} className="uppercase tracking-wider text-xs">
            Browse Past Challenges
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        onViewAll={() => navigate("/challenges")}
        showViewAll={(challenges?.length || 0) > 3}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {displayChallenges.map((challenge, idx) => (
          <motion.div
            key={challenge.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.08 }}
          >
            <ChallengeCard challenge={challenge} />
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
        <div className="w-1 h-6 rounded-full bg-primary" />
        <h2 className="font-display text-2xl tracking-wide">ACTIVE CHALLENGES</h2>
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
