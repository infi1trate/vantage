import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { ChallengeHero } from "@/components/challenges/ChallengeHero";
import { ChallengeRulesSection } from "@/components/challenges/ChallengeRulesSection";
import { HowToParticipate } from "@/components/challenges/HowToParticipate";
import { SubmissionFeed } from "@/components/challenges/SubmissionFeed";
import { 
  SubmissionEntrySheet,
  SubmissionModal,
  SessionPickerModal,
} from "@/components/challenges";
import { useChallenge, useChallengeSubmissions, useUserSubmissions } from "@/hooks/useChallenges";
import { useAuth } from "@/contexts/AuthContext";
import { getChallengeStatus } from "@/lib/challenges";

interface SelectedSession {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
}

export default function ChallengeDetail() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const { user } = useAuth();

  // Data fetching
  const { data: challenge, isLoading: loadingChallenge } = useChallenge(challengeId);
  const { data: allSubmissions, isLoading: loadingSubmissions } = useChallengeSubmissions(challengeId);
  const { data: userSubmissions } = useUserSubmissions(challengeId);

  // UI state
  const [showEntrySheet, setShowEntrySheet] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);

  // Redirect if no challenge ID
  if (!challengeId) {
    return <Navigate to="/challenges" replace />;
  }

  // Loading state
  if (loadingChallenge) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 md:px-6 py-8 space-y-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-video w-full max-w-xl rounded-xl" />
          <Skeleton className="h-12 w-96" />
          <Skeleton className="h-24 w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  if (!challenge) {
    return <Navigate to="/challenges" replace />;
  }

  const status = getChallengeStatus(challenge);
  const hasSubmitted = (userSubmissions?.length || 0) > 0;
  const canSubmit = status.isOpen && 
    (!challenge.max_submissions_per_user || 
     (userSubmissions?.length || 0) < challenge.max_submissions_per_user);

  const handleSelectFromLibrary = () => {
    setShowSessionPicker(true);
  };

  const handleSessionSelected = (session: SelectedSession) => {
    setSelectedSession(session);
    setShowSubmissionModal(true);
  };

  const handleSubmissionSuccess = () => {
    setSelectedSession(null);
    setShowSubmissionModal(false);
  };

  const handleVote = (submissionId: string) => {
    // Voting logic would go here - typically an API call
    console.log("Vote for submission:", submissionId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <ChallengeHero
        challenge={challenge}
        onSubmit={() => setShowEntrySheet(true)}
        canSubmit={canSubmit}
        hasSubmitted={hasSubmitted}
      />

      {/* Content */}
      <main className="px-4 md:px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Rules Section (Expandable) */}
        <ChallengeRulesSection 
          rules={challenge.rules}
          // These would come from challenge metadata in real implementation
          clipDurationMin={5}
          clipDurationMax={60}
        />

        {/* How to Participate (Collapsible) */}
        <HowToParticipate />

        {/* Submissions Feed */}
        <SubmissionFeed
          submissions={allSubmissions || []}
          isLoading={loadingSubmissions}
          isEnded={!status.isOpen}
          currentUserId={user?.id}
          onVote={handleVote}
        />
      </main>

      {/* Entry Sheet (Decision point) */}
      <SubmissionEntrySheet
        open={showEntrySheet}
        onOpenChange={setShowEntrySheet}
        challenge={challenge}
        onSelectFromLibrary={handleSelectFromLibrary}
      />

      {/* Session Picker */}
      <SessionPickerModal
        open={showSessionPicker}
        onOpenChange={setShowSessionPicker}
        onSelect={handleSessionSelected}
        selectedSessionId={selectedSession?.id}
      />

      {/* Submission Modal */}
      <SubmissionModal
        open={showSubmissionModal}
        onOpenChange={setShowSubmissionModal}
        challenge={challenge}
        selectedSession={selectedSession}
        onSuccess={handleSubmissionSuccess}
        onChangeSession={() => {
          setShowSubmissionModal(false);
          setShowSessionPicker(true);
        }}
      />
    </div>
  );
}
