/**
 * Winners Module Component
 * 
 * Displays top 3 winners for an ended challenge (read-only).
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Trophy, Medal, ThumbsUp, ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChallengeEntry } from "@/lib/challenges/types";

interface WinnersModuleProps {
  challengeId: string;
  winners: ChallengeEntry[];
  isLoading?: boolean;
}

const rankConfig = {
  1: { 
    icon: Crown, 
    label: "1st Place", 
    colors: "bg-amber-500/20 text-amber-500 border-amber-500/30",
    ring: "ring-amber-500/50"
  },
  2: { 
    icon: Medal, 
    label: "2nd Place", 
    colors: "bg-zinc-400/20 text-zinc-400 border-zinc-400/30",
    ring: "ring-zinc-400/50"
  },
  3: { 
    icon: Medal, 
    label: "3rd Place", 
    colors: "bg-orange-600/20 text-orange-600 border-orange-600/30",
    ring: "ring-orange-600/50"
  },
} as const;

function WinnerCard({ entry, rank }: { entry: ChallengeEntry; rank: 1 | 2 | 3 }) {
  const config = rankConfig[rank];
  const RankIcon = config.icon;
  
  return (
    <div className={cn(
      "relative rounded-lg border bg-card overflow-hidden",
      "ring-2 ring-offset-2 ring-offset-background",
      config.ring
    )}>
      {/* Clip Preview */}
      <div className="relative aspect-video bg-muted">
        {entry.posterUrl ? (
          <img 
            src={entry.posterUrl} 
            alt={`${entry.user.displayName || entry.user.username}'s winning clip`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        
        {/* Rank Badge */}
        <Badge 
          className={cn(
            "absolute top-2 left-2 gap-1",
            config.colors
          )}
        >
          <RankIcon className="h-3 w-3" />
          {config.label}
        </Badge>
        
        {/* Duration */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
          {entry.durationSec}s
        </div>
      </div>
      
      {/* User Info & Votes */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={entry.user.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {(entry.user.displayName || entry.user.username || "?")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">
              {entry.user.displayName || entry.user.username || "Anonymous"}
            </span>
          </div>
          
          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span className="text-sm font-medium">{entry.votesCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WinnerCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

export function WinnersModule({ challengeId, winners, isLoading }: WinnersModuleProps) {
  // Sort winners by rank
  const sortedWinners = [...winners]
    .filter(w => w.rank && w.rank >= 1 && w.rank <= 3)
    .sort((a, b) => (a.rank || 99) - (b.rank || 99))
    .slice(0, 3);
  
  const hasWinners = sortedWinners.length > 0;
  
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Winners</CardTitle>
              <CardDescription>
                {hasWinners 
                  ? `Top ${sortedWinners.length} winning entries` 
                  : "Winners will be announced soon"
                }
              </CardDescription>
            </div>
          </div>
          
          <Button variant="outline" size="sm" asChild>
            <Link to={`/challenges/${challengeId}`}>
              View Public Page
              <ExternalLink className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <WinnerCardSkeleton />
            <WinnerCardSkeleton />
            <WinnerCardSkeleton />
          </div>
        ) : hasWinners ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {sortedWinners.map((winner) => (
              <WinnerCard 
                key={winner.id} 
                entry={winner} 
                rank={winner.rank as 1 | 2 | 3} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No winners selected yet</p>
            <p className="text-sm">Winners are determined server-side after judging.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
