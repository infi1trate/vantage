/**
 * Admin Challenges Table Component
 * 
 * Displays all challenges in a table with actions.
 */

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  Pencil,
  Globe,
  GlobeLock,
  Trophy,
  Trash2,
  Flag,
  Sparkles,
  Users,
} from "lucide-react";
import type { AdminChallengeListItem } from "@/lib/challenges/types";

interface ChallengesTableProps {
  challenges: AdminChallengeListItem[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEnd: (id: string) => void;
  onDelete: (id: string) => void;
}

type ConfirmAction = {
  type: "publish" | "unpublish" | "end" | "delete";
  challengeId: string;
  challengeTitle: string;
};

function getStatusBadge(challenge: AdminChallengeListItem) {
  if (challenge.isDraft) {
    return (
      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted">
        Draft
      </Badge>
    );
  }
  
  switch (challenge.status) {
    case "active":
      return (
        <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
          Active
        </Badge>
      );
    case "upcoming":
      return (
        <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent/50">
          Scheduled
        </Badge>
      );
    case "ended":
      return (
        <Badge variant="outline" className="bg-muted/30 text-muted-foreground">
          Ended
        </Badge>
      );
    default:
      return null;
  }
}

export function ChallengesTable({
  challenges,
  isLoading,
  onEdit,
  onPublish,
  onUnpublish,
  onEnd,
  onDelete,
}: ChallengesTableProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleConfirm = () => {
    if (!confirmAction) return;
    
    switch (confirmAction.type) {
      case "publish":
        onPublish(confirmAction.challengeId);
        break;
      case "unpublish":
        onUnpublish(confirmAction.challengeId);
        break;
      case "end":
        onEnd(confirmAction.challengeId);
        break;
      case "delete":
        onDelete(confirmAction.challengeId);
        break;
    }
    setConfirmAction(null);
  };

  const getConfirmDialogContent = () => {
    if (!confirmAction) return { title: "", description: "", actionLabel: "", variant: "default" as const };
    
    switch (confirmAction.type) {
      case "publish":
        return {
          title: "Publish Challenge",
          description: `Are you sure you want to publish "${confirmAction.challengeTitle}"? It will become visible to all users.`,
          actionLabel: "Publish",
          variant: "default" as const,
        };
      case "unpublish":
        return {
          title: "Unpublish Challenge",
          description: `Are you sure you want to unpublish "${confirmAction.challengeTitle}"? It will be hidden from users and moved back to draft.`,
          actionLabel: "Unpublish",
          variant: "default" as const,
        };
      case "end":
        return {
          title: "End Challenge",
          description: `Are you sure you want to end "${confirmAction.challengeTitle}"? This will close submissions and mark the challenge as completed. This action cannot be undone.`,
          actionLabel: "End Challenge",
          variant: "destructive" as const,
        };
      case "delete":
        return {
          title: "Delete Challenge",
          description: `Are you sure you want to delete "${confirmAction.challengeTitle}"? This action cannot be undone and will permanently remove all associated submissions.`,
          actionLabel: "Delete",
          variant: "destructive" as const,
        };
      default:
        return { title: "", description: "", actionLabel: "", variant: "default" as const };
    }
  };

  const dialogContent = getConfirmDialogContent();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[280px]">Challenge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Prize</TableHead>
              <TableHead className="text-center">Submissions</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No challenges found</h3>
        <p className="text-muted-foreground text-sm">
          No challenges match your current filters. Try adjusting or create a new one.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[280px]">Challenge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Prize</TableHead>
              <TableHead className="text-center">Submissions</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challenges.map((challenge) => (
              <TableRow key={challenge.id} className="group">
                <TableCell>
                  <div className="flex items-start gap-3">
                    {challenge.thumbnailUrl ? (
                      <img
                        src={challenge.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted/50 flex items-center justify-center shrink-0">
                        <Trophy className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{challenge.title}</span>
                        {challenge.isSponsored && (
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{challenge.game}</span>
                        {challenge.sponsor && (
                          <>
                            <span>•</span>
                            <span className="text-primary">{challenge.sponsor.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(challenge)}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="text-foreground">
                      {format(new Date(challenge.startAt), "MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      → {challenge.endAt ? format(new Date(challenge.endAt), "MMM d, yyyy") : "No end date"}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {challenge.prizePool ? (
                    <span className="font-medium text-primary">{challenge.prizePool}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{challenge.submissionsCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(challenge.id)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      
                      {challenge.isDraft ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmAction({
                              type: "publish",
                              challengeId: challenge.id,
                              challengeTitle: challenge.title,
                            })
                          }
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          Publish
                        </DropdownMenuItem>
                      ) : challenge.status !== "ended" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmAction({
                              type: "unpublish",
                              challengeId: challenge.id,
                              challengeTitle: challenge.title,
                            })
                          }
                        >
                          <GlobeLock className="h-4 w-4 mr-2" />
                          Unpublish
                        </DropdownMenuItem>
                      ) : null}
                      
                      {challenge.status === "active" && (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmAction({
                              type: "end",
                              challengeId: challenge.id,
                              challengeTitle: challenge.title,
                            })
                          }
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          End Challenge
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setConfirmAction({
                            type: "delete",
                            challengeId: challenge.id,
                            challengeTitle: challenge.title,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                dialogContent.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {dialogContent.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
