import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { updateCaptureSession, getCaptureSession, CaptureSession } from "@/lib/captures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Square, Pause, Play, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function CapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [ending, setEnding] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (sessionId && user) {
      loadSession();
    }
  }, [sessionId, user]);

  // Timer effect
  useEffect(() => {
    if (isCapturing && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isCapturing, isPaused]);

  const loadSession = async () => {
    try {
      const data = await getCaptureSession(sessionId!);
      setSession(data);
      
      if (data.status !== "recording") {
        navigate(`/session/${sessionId}`);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Session not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      startTimeRef.current = Date.now() - (elapsedTime * 1000);
    }
    setIsPaused(!isPaused);
  };

  const handleEndCapture = async () => {
    if (!session) return;
    
    setEnding(true);
    try {
      await updateCaptureSession(session.id, {
        status: "processing",
        duration_seconds: elapsedTime,
      });

      // Simulate processing delay then mark as ready
      setTimeout(async () => {
        await updateCaptureSession(session.id, { status: "ready" });
      }, 2000);

      toast.success("Capture ended! Processing...");
      navigate(`/session/${session.id}`);
    } catch (error: any) {
      console.error("Error ending capture:", error);
      toast.error("Failed to end capture");
    } finally {
      setEnding(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          {/* Recording Status */}
          <Card className="p-8 bg-card border-border/50 mb-8">
            <div className="text-center">
              {/* Recording indicator */}
              <div className="inline-flex items-center gap-2 mb-6">
                <span className={`w-3 h-3 rounded-full ${isPaused ? "bg-yellow-500" : "bg-red-500 recording-pulse"}`} />
                <Badge variant="outline" className={isPaused ? "border-yellow-500/30 text-yellow-400" : "border-red-500/30 text-red-400"}>
                  {isPaused ? "PAUSED" : "RECORDING"}
                </Badge>
              </div>

              {/* Timer */}
              <div className="mb-6">
                <p className="text-6xl font-bold font-mono-data text-foreground mb-2">
                  {formatTime(elapsedTime)}
                </p>
                <p className="text-muted-foreground">{session.title}</p>
                {session.game_name && (
                  <p className="text-sm text-primary">{session.game_name}</p>
                )}
              </div>

              {/* Simulated capture preview */}
              <div className="aspect-video bg-muted/50 rounded-lg mb-8 flex items-center justify-center border border-border/50 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-muted/80 via-background to-muted/80" />
                <div className="relative text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className={`w-8 h-8 rounded-full ${isPaused ? "bg-yellow-500" : "bg-red-500 recording-pulse"}`} />
                  </div>
                  <p className="text-muted-foreground">
                    {isPaused ? "Capture paused" : "Capturing gameplay..."}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    (Screen capture simulated in web preview)
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handlePauseResume}
                  className="min-w-32"
                >
                  {isPaused ? (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      Pause
                    </>
                  )}
                </Button>

                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleEndCapture}
                  disabled={ending}
                  className="min-w-32"
                >
                  {ending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Ending...
                    </>
                  ) : (
                    <>
                      <Square className="mr-2 h-5 w-5" fill="currentColor" />
                      End Capture
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Tips */}
          <Card className="p-6 bg-card/50 border-border/50">
            <h3 className="font-semibold mb-4">During Capture</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-vantage-success mt-0.5 shrink-0" />
                Your gameplay is being recorded continuously
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-vantage-success mt-0.5 shrink-0" />
                You can pause and resume at any time
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-vantage-warning mt-0.5 shrink-0" />
                Annotations and voice notes can be added after capture
              </li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
