import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { SessionCard } from "@/components/captures/SessionCard";
import { OpenVantageModal } from "@/components/capture/OpenVantageModal";
import { getCaptureSessions, CaptureSession } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Video, BarChart3, Clock } from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenVantage, setShowOpenVantage] = useState(false);

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
      
      <main className="container py-10">
        {/* Hero Section */}
        <section className="mb-14">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Welcome back</p>
              <h1 className="font-display text-5xl lg:text-6xl tracking-wide text-foreground">
                {user.email?.split("@")[0].toUpperCase()}
              </h1>
            </div>
            
            <Button 
              size="lg" 
              onClick={() => setShowOpenVantage(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider glow-primary"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Capture
            </Button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          <Card className="p-6 bg-card border-border/30 group hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Captures</p>
                <p className="font-display text-5xl text-foreground">{stats.totalSessions}</p>
              </div>
              <div className="p-2 rounded bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border/30 group hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Ready for Review</p>
                <p className="font-display text-5xl text-foreground">{stats.readySessions}</p>
              </div>
              <div className="p-2 rounded bg-vantage-success/10">
                <BarChart3 className="h-5 w-5 text-vantage-success" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border/30 group hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Time Recorded</p>
                <p className="font-display text-5xl text-foreground">
                  {Math.floor(stats.totalDuration / 3600)}H {Math.floor((stats.totalDuration % 3600) / 60)}M
                </p>
              </div>
              <div className="p-2 rounded bg-vantage-teal/10">
                <Clock className="h-5 w-5 text-vantage-teal" />
              </div>
            </div>
          </Card>
        </section>

        {/* Recent Captures */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl tracking-wide">Recent Captures</h2>
            {sessions.length > 6 && (
              <Button variant="ghost" onClick={() => navigate("/library")} className="uppercase text-xs tracking-wider">
                View all
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recentSessions.length === 0 ? (
            <Card className="p-12 bg-card border-border/30 border-dashed">
              <div className="text-center">
                <Video className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-display text-2xl mb-2">No Captures Yet</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                  Start your first capture session to begin analyzing your gameplay decisions
                </p>
                <Button onClick={() => setShowOpenVantage(true)} className="uppercase tracking-wider font-bold">
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

      <OpenVantageModal open={showOpenVantage} onOpenChange={setShowOpenVantage} />
    </div>
  );
}
