import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChallengeGrid } from "@/components/challenges/ChallengeGrid";
import { useChallenges } from "@/hooks/useChallenges";
import { Trophy } from "lucide-react";

export default function Challenges() {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  const { data: activeChallenges, isLoading: loadingActive } = useChallenges(["active", "judging"]);
  const { data: completedChallenges, isLoading: loadingCompleted } = useChallenges("completed");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-4 md:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-wide">
              CHALLENGES
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Compete in community challenges, showcase your skills, and win recognition.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "completed")}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="flex-1 sm:flex-none">
              Active
              {activeChallenges && activeChallenges.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                  {activeChallenges.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 sm:flex-none">
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            <ChallengeGrid
              challenges={activeChallenges}
              isLoading={loadingActive}
              emptyTitle="No active challenges"
              emptyDescription="There are no active challenges right now. Check back soon!"
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <ChallengeGrid
              challenges={completedChallenges}
              isLoading={loadingCompleted}
              emptyTitle="No completed challenges yet"
              emptyDescription="Completed challenges will appear here."
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
