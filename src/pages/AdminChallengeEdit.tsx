/**
 * Admin Challenge Edit Page
 * 
 * Edit existing challenges with state-based field restrictions.
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { 
  ChallengeForm, 
  challengeFormSchema, 
  type ChallengeFormValues,
  type DisabledFields,
} from "@/components/admin/ChallengeForm";
import { WinnersModule } from "@/components/admin/WinnersModule";
import {
  useAdminPublishChallenge,
  useAdminUnpublishChallenge,
  useAdminEndChallenge,
  useAdminDeleteChallenge,
} from "@/hooks/useAdminChallenges";
import { getChallengeDetail, adminUpdateChallenge, getChallengeWinners } from "@/lib/challenges/api";
import {
  Trophy,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Save,
  Globe,
  GlobeLock,
  X,
  Trash2,
  Flag,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

type ConfirmAction = "publish" | "unpublish" | "end" | "delete" | null;

export default function AdminChallengeEdit() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading, isChallengeAdmin } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // Mutations
  const publishMutation = useAdminPublishChallenge();
  const unpublishMutation = useAdminUnpublishChallenge();
  const endMutation = useAdminEndChallenge();
  const deleteMutation = useAdminDeleteChallenge();

  // Fetch challenge data
  const { data: challenge, isLoading: isLoadingChallenge, error } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => getChallengeDetail(id!),
    enabled: !!id && isChallengeAdmin,
    staleTime: 30 * 1000,
  });

  // Fetch winners for ended challenges
  const { data: winners = [], isLoading: isLoadingWinners } = useQuery({
    queryKey: ["challenge-winners", id],
    queryFn: () => getChallengeWinners(id!),
    enabled: !!id && isChallengeAdmin && challenge?.status === "ended",
    staleTime: 60 * 1000,
  });

  const form = useForm<ChallengeFormValues>({
    resolver: zodResolver(challengeFormSchema),
    defaultValues: {
      title: "",
      game: "",
      difficulty: 3,
      heroMediaUrl: "",
      rulesSummary: "",
      rulesFull: "",
      startAt: new Date(),
      endAt: new Date(),
      minDurationSeconds: 6,
      maxDurationSeconds: 30,
      prizeAmount: 0,
      prizeCurrency: "USDC",
      prize1stAmount: 0,
      prize2ndAmount: 0,
      prize3rdAmount: 0,
      maxSubmissionsPerUser: 10,
      isSponsored: false,
      sponsorName: "",
      sponsorLogoUrl: "",
      sponsorLink: "",
    },
  });

  // Populate form when challenge loads
  useEffect(() => {
    if (challenge) {
      // Parse prize pool string (e.g., "100 USDC")
      let prizeAmount = 0;
      let prizeCurrency = "USDC";
      if (challenge.prizePool) {
        const match = challenge.prizePool.match(/^([\d.]+)\s*(\w+)$/);
        if (match) {
          prizeAmount = parseFloat(match[1]);
          prizeCurrency = match[2];
        }
      }

      // Parse top 3 prizes
      const prize1st = challenge.prizesTop3?.find(p => p.rank === 1)?.amount || 0;
      const prize2nd = challenge.prizesTop3?.find(p => p.rank === 2)?.amount || 0;
      const prize3rd = challenge.prizesTop3?.find(p => p.rank === 3)?.amount || 0;

      form.reset({
        title: challenge.title,
        game: challenge.game,
        difficulty: challenge.difficulty,
        heroMediaUrl: challenge.heroMediaUrl || "",
        rulesSummary: challenge.rulesSummary || "",
        rulesFull: challenge.rulesFull || "",
        startAt: new Date(challenge.startAt),
        endAt: new Date(challenge.endAt),
        minDurationSeconds: 6, // Not stored in challenge yet
        maxDurationSeconds: 30, // Not stored in challenge yet
        prizeAmount,
        prizeCurrency,
        prize1stAmount: prize1st,
        prize2ndAmount: prize2nd,
        prize3rdAmount: prize3rd,
        maxSubmissionsPerUser: 10, // Would need to be added to Challenge type
        isSponsored: challenge.isSponsored,
        sponsorName: challenge.sponsor?.name || "",
        sponsorLogoUrl: challenge.sponsor?.logoUrl || "",
        sponsorLink: challenge.sponsor?.websiteUrl || "",
      });
    }
  }, [challenge, form]);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!user || !isChallengeAdmin)) {
      toast.error("You don't have access to this page.");
      navigate("/settings", { replace: true });
    }
  }, [authLoading, user, isChallengeAdmin, navigate]);

  // Determine challenge state and restrictions
  const challengeState = useMemo(() => {
    if (!challenge) return { isDraft: true, isActive: false, isEnded: false, isScheduled: false };
    
    const now = new Date();
    const startAt = new Date(challenge.startAt);
    const endAt = new Date(challenge.endAt);
    
    // Check if it's a draft (status check would be more reliable if available)
    const isDraft = challenge.status === "upcoming" && now < startAt;
    const isActive = challenge.status === "active";
    const isEnded = challenge.status === "ended";
    const isScheduled = challenge.status === "upcoming" && now < startAt;
    
    return { isDraft, isActive, isEnded, isScheduled };
  }, [challenge]);

  // Determine which fields to disable based on state
  const disabledFields: DisabledFields = useMemo(() => {
    if (challengeState.isEnded) {
      // Read-only for ended challenges
      return {};
    }
    if (challengeState.isActive) {
      // Active: lock timing and prizes to avoid disputes
      return {
        timing: true,
        prizes: true,
        game: true,
        clipRequirements: true,
        submissionRules: true,
      };
    }
    // Draft/Scheduled: all editable
    return {};
  }, [challengeState]);

  const isReadOnly = challengeState.isEnded;

  // Handle form submission
  const handleSave = async (values: ChallengeFormValues) => {
    if (!id || isReadOnly) return;
    
    setIsSubmitting(true);
    try {
      await adminUpdateChallenge(id, {
        title: values.title,
        game: values.game,
        difficulty: values.difficulty as 1 | 2 | 3 | 4 | 5,
        rulesSummary: values.rulesSummary,
        rulesFull: values.rulesFull,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt.toISOString(),
        heroMediaUrl: values.heroMediaUrl || undefined,
        prizePool: values.prizeAmount > 0 ? `${values.prizeAmount} ${values.prizeCurrency}` : undefined,
        prizesTop3: values.prizeAmount > 0 ? [
          { rank: 1 as const, amount: values.prize1stAmount, currency: values.prizeCurrency },
          { rank: 2 as const, amount: values.prize2ndAmount, currency: values.prizeCurrency },
          { rank: 3 as const, amount: values.prize3rdAmount, currency: values.prizeCurrency },
        ] : undefined,
        maxSubmissionsPerUser: values.maxSubmissionsPerUser,
        sponsor: values.isSponsored && values.sponsorName ? {
          name: values.sponsorName,
          logoUrl: values.sponsorLogoUrl || undefined,
          websiteUrl: values.sponsorLink || undefined,
        } : undefined,
      });
      
      toast.success("Challenge updated");
    } catch (error) {
      console.error("Failed to update challenge:", error);
      toast.error("Failed to update challenge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSave = form.handleSubmit(handleSave);

  // Action handlers
  const handleConfirmAction = async () => {
    if (!id || !confirmAction) return;
    
    try {
      switch (confirmAction) {
        case "publish":
          await publishMutation.mutateAsync(id);
          break;
        case "unpublish":
          await unpublishMutation.mutateAsync(id);
          break;
        case "end":
          await endMutation.mutateAsync(id);
          break;
        case "delete":
          await deleteMutation.mutateAsync(id);
          navigate("/settings/admin/challenges");
          break;
      }
    } catch (error) {
      // Errors handled by mutation hooks
    } finally {
      setConfirmAction(null);
    }
  };

  const getConfirmDialogContent = () => {
    switch (confirmAction) {
      case "publish":
        return {
          title: "Publish Challenge",
          description: `Are you sure you want to publish "${challenge?.title}"? It will become visible to all users.`,
          actionLabel: "Publish",
          variant: "default" as const,
        };
      case "unpublish":
        return {
          title: "Unpublish Challenge",
          description: `Are you sure you want to unpublish "${challenge?.title}"? It will be hidden from users.`,
          actionLabel: "Unpublish",
          variant: "default" as const,
        };
      case "end":
        return {
          title: "End Challenge Early",
          description: `Are you sure you want to end "${challenge?.title}" early? This will close submissions immediately. This action cannot be undone.`,
          actionLabel: "End Challenge",
          variant: "destructive" as const,
        };
      case "delete":
        return {
          title: "Delete Challenge",
          description: `Are you sure you want to delete "${challenge?.title}"? This action cannot be undone.`,
          actionLabel: "Delete",
          variant: "destructive" as const,
        };
      default:
        return { title: "", description: "", actionLabel: "", variant: "default" as const };
    }
  };

  const dialogContent = getConfirmDialogContent();
  const isMutating = publishMutation.isPending || unpublishMutation.isPending || 
                     endMutation.isPending || deleteMutation.isPending;

  // Loading states
  if (authLoading || isLoadingChallenge) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // 403 if not admin
  if (!isChallengeAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have permission to edit challenges.
            </p>
            <Button onClick={() => navigate("/settings")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 404 if challenge not found
  if (error || !challenge) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Trophy className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Challenge Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The challenge you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate("/settings/admin/challenges")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Challenges
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Page Header */}
      <div className="border-b border-border/30 bg-card/30">
        <div className="container py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => navigate("/settings/admin/challenges")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Challenges
            </Button>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px]">{challenge.title}</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl font-bold">Edit Challenge</h1>
                  <Badge 
                    variant="outline" 
                    className={
                      challengeState.isActive ? "bg-primary/20 text-primary border-primary/30" :
                      challengeState.isEnded ? "bg-muted/50 text-muted-foreground" :
                      "bg-accent/50 text-accent-foreground"
                    }
                  >
                    {challengeState.isActive ? "Active" : 
                     challengeState.isEnded ? "Ended" : 
                     challengeState.isScheduled ? "Scheduled" : "Draft"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isReadOnly ? "View-only (challenge has ended)" : "Update challenge details"}
                </p>
              </div>
            </div>
          </div>

          {/* Active challenge warning */}
          {challengeState.isActive && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary">Challenge is live</p>
                <p className="text-sm text-muted-foreground">
                  Some fields are locked to prevent disputes. You can still edit title, rules, hero media, and sponsor info.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <main className="container flex-1 py-8 space-y-8">
        {/* Winners Module for ended challenges */}
        {challengeState.isEnded && id && (
          <WinnersModule 
            challengeId={id} 
            winners={winners} 
            isLoading={isLoadingWinners}
          />
        )}
        
        <ChallengeForm
          form={form}
          isReadOnly={isReadOnly}
          disabledFields={disabledFields}
          statusOverride={
            challengeState.isActive ? "Active" :
            challengeState.isEnded ? "Ended" :
            challengeState.isScheduled ? "Scheduled" : "Draft"
          }
        />

        {/* Footer Actions */}
        {!isReadOnly && (
          <div className="max-w-3xl mt-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/settings/admin/challenges")}
                disabled={isSubmitting || isMutating}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>

              {/* Delete - only for drafts */}
              {(challengeState.isDraft || challengeState.isScheduled) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmAction("delete")}
                  disabled={isSubmitting || isMutating}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* End early - for active challenges */}
              {challengeState.isActive && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction("end")}
                  disabled={isSubmitting || isMutating}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  End Early
                </Button>
              )}

              {/* Publish/Unpublish */}
              {(challengeState.isDraft || challengeState.isScheduled) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction("publish")}
                  disabled={isSubmitting || isMutating}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Publish
                </Button>
              )}

              {challengeState.isActive && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction("unpublish")}
                  disabled={isSubmitting || isMutating}
                >
                  <GlobeLock className="h-4 w-4 mr-2" />
                  Unpublish
                </Button>
              )}

              {/* Save */}
              <Button
                type="button"
                onClick={onSave}
                disabled={isSubmitting || isMutating}
                className="flex-1 sm:flex-none"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Read-only footer */}
        {isReadOnly && (
          <div className="max-w-3xl mt-8 flex items-center justify-center gap-4 pt-4 border-t border-border/30">
            <Button
              variant="outline"
              onClick={() => navigate("/settings/admin/challenges")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Challenges
            </Button>
            <Button asChild>
              <Link to={`/challenges/${id}`}>
                View Public Page
                <ExternalLink className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={isMutating}
              className={
                dialogContent.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogContent.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
