import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { SessionCard } from "@/components/captures/SessionCard";
import { NewCaptureDialog } from "@/components/captures/NewCaptureDialog";
import { getCaptureSessions, CaptureSession } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Video, Target, BarChart3, Users } from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCapture, setShowNewCapture] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    
    try {
      const data = await getCaptureSessions(user.id);
      setSessions(data);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const recentSessions = sessions.slice(0, 6);
  const stats = {
    totalSessions: sessions.length,
    totalDuration: sessions.reduce((acc, s) => acc + s.duration_seconds, 0),
    readySessions: sessions.filter(s => s.status === "ready").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome back, <span className="text-gradient-primary">{user.email?.split("@")[0]}</span>
              </h1>
              <p className="text-muted-foreground">
                Capture, analyze, and improve your gameplay
              </p>
            </div>
            
            <Button 
              size="lg" 
              onClick={() => setShowNewCapture(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Capture
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{stats.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total Captures</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Target className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">{stats.readySessions}</p>
                <p className="text-sm text-muted-foreground">Ready for Review</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-vantage-success/10">
                <BarChart3 className="h-6 w-6 text-vantage-success" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-data">
                  {Math.floor(stats.totalDuration / 3600)}h {Math.floor((stats.totalDuration % 3600) / 60)}m
                </p>
                <p className="text-sm text-muted-foreground">Gameplay Recorded</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Recent Captures */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent Captures</h2>
            {sessions.length > 6 && (
              <Button variant="ghost" onClick={() => navigate("/library")}>
                View all
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recentSessions.length === 0 ? (
            <Card className="p-12 bg-card border-border/50 border-dashed">
              <div className="text-center">
                <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No captures yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start your first capture session to begin analyzing your gameplay
                </p>
                <Button onClick={() => setShowNewCapture(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Capture
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </main>

      <NewCaptureDialog open={showNewCapture} onOpenChange={setShowNewCapture} />
    </div>
  );
}
