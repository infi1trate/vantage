import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChallengeHeader, 
  ChallengeRules, 
  SubmissionCard,
  SubmissionEntrySheet,
  SubmissionModal,
} from "@/components/challenges";
import { SessionPickerModal } from "@/components/challenges/SessionPickerModal";
import { useChallenge, useChallengeSubmissions, useUserSubmissions } from "@/hooks/useChallenges";
import { useAuth } from "@/contexts/AuthContext";
import { getChallengeStatus } from "@/lib/challenges";
import { Trophy, Users } from "lucide-react";

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
        <div className="px-4 md:px-6 py-8 space-y-6">
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

  // Filter submissions by status
  const approvedSubmissions = allSubmissions?.filter(s => s.status === 'approved' || s.status === 'winner') || [];
  const winnerSubmissions = allSubmissions?.filter(s => s.status === 'winner') || [];

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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Challenge Header */}
      <ChallengeHeader
        challenge={challenge}
        onSubmit={() => setShowEntrySheet(true)}
        canSubmit={canSubmit}
        hasSubmitted={hasSubmitted}
      />

      {/* Content */}
      <main className="px-4 md:px-6 py-8 space-y-8">
        {/* Rules */}
        <ChallengeRules rules={challenge.rules} />

        {/* Submissions */}
        <div className="space-y-6">
          <Tabs defaultValue="submissions">
            <TabsList>
              <TabsTrigger value="submissions" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Submissions
                {approvedSubmissions.length > 0 && (
                  <span className="ml-1 text-xs">({approvedSubmissions.length})</span>
                )}
              </TabsTrigger>
              {winnerSubmissions.length > 0 && (
                <TabsTrigger value="winners" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Winners
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="submissions" className="mt-6">
              {loadingSubmissions ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-video w-full rounded-lg" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : approvedSubmissions.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No submissions yet. Be the first!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {approvedSubmissions.map((submission) => (
                    <SubmissionCard
                      key={submission.id}
                      submission={submission}
                      isOwn={submission.user_id === user?.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="winners" className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {winnerSubmissions.map((submission) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    isOwn={submission.user_id === user?.id}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Entry Sheet */}
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
