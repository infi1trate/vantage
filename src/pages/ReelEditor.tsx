/**
 * Reel Editor Page
 * 
 * Dedicated editing environment for Reels. Contains:
 * - Reel-only preview player
 * - Effects Lane (VFX/SFX)
 * - Frames configuration
 * - Reel Package tools (intro/outro/transitions)
 * - Export / Share
 * 
 * Session Detail remains read-only; all editing happens here.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { useReel } from "@/hooks/useReel";
import { useReelPackage, useTriggerGeneration } from "@/hooks/useReelPackageConfig";
import { PlayerWithEffects } from "@/components/player/PlayerWithEffects";
import { ReelEditorToolbar } from "@/components/reel/ReelEditorToolbar";
import { ReelEditorSidebar } from "@/components/reel/ReelEditorSidebar";
import { ExportButton } from "@/components/export/ExportButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Film, 
  Loader2,
  Save,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSafeBack } from "@/hooks/useSafeBack";
import { getAnnotations, Annotation, getCaptureSession } from "@/lib/captures";

export default function ReelEditor() {
  const { reelId } = useParams<{ reelId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { goBack } = useSafeBack("/library");

  // Reel data
  const { data: reel, isLoading: reelLoading, error: reelError } = useReel(reelId);
  
  // Reel package configuration
  const { config: reelPackage, isLoading: packageLoading } = useReelPackage(
    reel?.session_id || undefined
  );

  // Session data for source video
  const [sessionData, setSessionData] = useState<{
    videoUrl: string | null;
    duration: number;
    title: string;
  } | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Player state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Editor state
  const [activeTab, setActiveTab] = useState<"effects" | "frames" | "package">("effects");
  const [showEffects, setShowEffects] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load session data when reel is loaded
  useEffect(() => {
    async function loadSessionData() {
      if (!reel?.session_id) return;

      try {
        setLoading(true);
        const [session, annots] = await Promise.all([
          getCaptureSession(reel.session_id),
          getAnnotations(reel.session_id),
        ]);

        if (session) {
          setSessionData({
            videoUrl: session.video_url,
            duration: session.duration_seconds || 0,
            title: session.title,
          });
          setDuration(session.duration_seconds || 0);
        }
        setAnnotations(annots);
      } catch (err) {
        console.error("Failed to load session data:", err);
        toast.error("Failed to load session data");
      } finally {
        setLoading(false);
      }
    }

    loadSessionData();
  }, [reel?.session_id]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleVideoLoaded = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  const handleSave = useCallback(() => {
    // TODO: Implement save logic
    setHasUnsavedChanges(false);
    toast.success("Changes saved");
  }, []);

  // Filter annotations to only those included in the reel
  const reelMoments = useMemo(() => {
    if (!reel?.source_moment_ids?.length) return annotations;
    return annotations.filter(a => reel.source_moment_ids.includes(a.id));
  }, [annotations, reel?.source_moment_ids]);

  // Loading states
  if (authLoading || reelLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Error state
  if (reelError || !reel) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-4">
          <p className="text-muted-foreground">Reel not found</p>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      {/* Editor Header */}
      <div className="border-b border-border/40 bg-card/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-lg">{reel.title}</h1>
              <Badge variant="outline" className="text-xs">
                {reel.aspect_ratio}
              </Badge>
              {reel.status === "draft" && (
                <Badge variant="secondary" className="text-xs">
                  Draft
                </Badge>
              )}
              {reel.status === "rendering" && (
                <Badge className="text-xs bg-vantage-warning/20 text-vantage-warning border-vantage-warning/30">
                  Rendering
                </Badge>
              )}
              {reel.status === "ready" && (
                <Badge className="text-xs bg-vantage-success/20 text-vantage-success border-vantage-success/30">
                  Ready
                </Badge>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            )}
            
            <ExportButton 
              sessionId={reel.session_id || ""} 
              onExport={() => {
                // TODO: Trigger export for this reel
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview + Timeline (Main Area) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Player with Effects */}
          <div className="flex-1 min-h-0 p-4">
            <div className="h-full bg-black/20 rounded-lg overflow-hidden">
              <PlayerWithEffects
                sessionId={reel.session_id || ""}
                videoUrl={sessionData?.videoUrl}
                duration={duration}
                currentTime={currentTime}
                onTimeUpdate={handleTimeUpdate}
                onSeek={handleSeek}
                annotations={reelMoments}
                voiceNotes={[]}
                onVideoLoaded={handleVideoLoaded}
                showEffects={showEffects}
              />
            </div>
          </div>

          {/* Editor Toolbar */}
          <ReelEditorToolbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showEffects={showEffects}
            onShowEffectsChange={setShowEffects}
          />
        </div>

        {/* Right Sidebar: Tools */}
        <ReelEditorSidebar
          reelId={reel.id}
          sessionId={reel.session_id || ""}
          activeTab={activeTab}
          reelPackage={reelPackage}
          onChangesMade={() => setHasUnsavedChanges(true)}
        />
      </div>
    </div>
  );
}
