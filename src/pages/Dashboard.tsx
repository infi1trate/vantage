import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { OpenVantageModal } from "@/components/capture/OpenVantageModal";
import { getCaptureSessions, CaptureSession } from "@/lib/captures";
import { fetchChallenges, type Challenge } from "@/lib/challenges";
import { Loader2 } from "lucide-react";

import { HeroActionModule } from "@/components/dashboard/HeroActionModule";
import { CommunityDiscoverySection } from "@/components/dashboard/CommunityDiscoverySection";
import { ChallengesEngagementSection } from "@/components/dashboard/ChallengesEngagementSection";
import { PersonalActivitySection } from "@/components/dashboard/PersonalActivitySection";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenVantage, setShowOpenVantage] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      Promise.all([
        getCaptureSessions(user.id).catch(() => [] as CaptureSession[]),
        fetchChallenges("active").catch(() => [] as Challenge[]),
      ]).then(([sessionsData, challengesData]) => {
        setSessions(sessionsData);
        setActiveChallenges(challengesData);
        setLoading(false);
      });
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 md:py-10 space-y-12 md:space-y-16">
        {/* 1. Hero Action Module */}
        <HeroActionModule
          user={user}
          sessions={sessions}
          activeChallenges={activeChallenges}
          onOpenVantage={() => setShowOpenVantage(true)}
        />

        {/* 2. Community Discovery */}
        <CommunityDiscoverySection />

        {/* 3. Challenges Engagement */}
        <ChallengesEngagementSection />

        {/* 4. Personal Activity (lightweight) */}
        <PersonalActivitySection sessions={sessions} loading={loading} />
      </main>

      <OpenVantageModal open={showOpenVantage} onOpenChange={setShowOpenVantage} />
    </div>
  );
}
