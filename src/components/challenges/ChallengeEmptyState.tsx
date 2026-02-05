import { Trophy } from "lucide-react";

interface ChallengeEmptyStateProps {
  title?: string;
  description?: string;
}

export function ChallengeEmptyState({
  title = "No challenges yet",
  description = "Check back soon for new challenges to compete in.",
}: ChallengeEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Trophy className="h-10 w-10 text-primary/50" />
      </div>
      <h3 className="font-display text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
