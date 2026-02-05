import { type Challenge } from "@/lib/challenges";
import { ChallengeCard } from "./ChallengeCard";
import { ChallengeEmptyState } from "./ChallengeEmptyState";
import { Skeleton } from "@/components/ui/skeleton";

interface ChallengeGridProps {
  challenges: Challenge[] | undefined;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ChallengeGrid({
  challenges,
  isLoading,
  emptyTitle,
  emptyDescription,
}: ChallengeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!challenges || challenges.length === 0) {
    return <ChallengeEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {challenges.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} />
      ))}
    </div>
  );
}
