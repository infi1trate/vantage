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
import { useReelPackage } from "@/hooks/useReelPackageConfig";
import { useEffectsTimeline } from "@/hooks/useEffectsTimeline";
import { useClearSessionEffects } from "@/hooks/useEffectEvents";
import { PlayerWithEffects } from "@/components/player/PlayerWithEffects";
import { ReelEditorToolbar } from "@/components/reel/ReelEditorToolbar";
import { ReelEditorSidebar } from "@/components/reel/ReelEditorSidebar";
import { CompilationPhase } from "@/components/reel/ReelCompilationStatus";
import { ReelCompilingPlaceholder } from "@/components/reel/ReelCompilingPlaceholder";
import { ReelEditorIntroModal } from "@/components/reel/ReelEditorIntroModal";
import { ExportButton } from "@/components/export/ExportButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Film, 
  Loader2,
  Save,
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
  
  // Derive compilation phase (for new reels still being assembled)
  const compilationPhase: CompilationPhase = useMemo(() => {
    if (!reel) return "idle";
    // Check explicit compiling status first
    if (reel.status === "compiling") return "assembling";
    // If video URL exists and session data loaded, reel is ready
    if (sessionData?.videoUrl && duration > 0) return "ready";
    // Still loading session data
    if (loading) return "assembling";
    return "ready";
  }, [reel, reel?.status, sessionData?.videoUrl, duration, loading]);
  
  // Check if reel is ready for editing (not compiling)
  const isReelReady = compilationPhase === "ready";
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Filter annotations to only those included in the reel
  const reelMoments = useMemo(() => {
    if (!reel?.source_moment_ids?.length) return annotations;
    return annotations.filter(a => reel.source_moment_ids.includes(a.id));
  }, [annotations, reel?.source_moment_ids]);

  // Effects timeline state - this powers the drag-and-drop FX system
  const {
    effects,
    isDragging,
    snapSettings,
    setSnapSettings,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleEffectUpdate,
    handleEffectDelete,
    handleEffectDuplicate,
    canUndo,
    canRedo,
    undo,
    redo,
    proposedEffects,
    isAutoEnhancing,
    generateSuggestions,
    applyProposedEffects,
    applyAllProposedEffects,
  } = useEffectsTimeline({
    sessionId: reel?.session_id,
    annotations: reelMoments,
    duration: duration * 1000, // Convert to ms
  });

  // Clear effects mutation
  const clearEffectsMutation = useClearSessionEffects();

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

  // Global drag end handler
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };
    
    window.addEventListener("dragend", handleGlobalDragEnd);
    return () => window.removeEventListener("dragend", handleGlobalDragEnd);
  }, [isDragging, handleDragEnd]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey && canRedo) {
          redo();
        } else if (canUndo) {
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

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
    // Effects are auto-saved, this is for frame config
    setHasUnsavedChanges(false);
    toast.success("Changes saved");
  }, []);

  const handleAutoEnhance = useCallback(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  const handleClearAllEffects = useCallback(() => {
    if (!reel?.session_id) return;
    clearEffectsMutation.mutate(reel.session_id, {
      onSuccess: () => {
        toast.success("All effects cleared");
      },
    });
  }, [reel?.session_id, clearEffectsMutation]);

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
      
      {/* First-time intro modal */}
      <ReelEditorIntroModal isReelReady={isReelReady} />
      
      {/* Editor Header - Compact layout with mode indicator */}
      <div className="border-b border-border/40 bg-card/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          {/* Left: Back + Mode Pill + Title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            {/* Reel Editor Mode Pill - subtle yellow outline */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-vantage-warning/40 bg-vantage-warning/5">
              <Film className="h-3.5 w-3.5 text-vantage-warning" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-vantage-warning">
                Reel Editor
              </span>
            </div>
            
            {/* Divider */}
            <div className="w-px h-5 bg-border/50" />
            
            {/* Title + Badges */}
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">{reel.title}</h1>
              <Badge variant="outline" className="text-xs">
                {reel.aspect_ratio}
              </Badge>
              {effects.length > 0 && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  {effects.length} FX
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
                toast.info("Rendering effects...", {
                  description: `${effects.length} effects will be composited into the final video`,
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* Compilation Status - shown when reel is still being assembled */}
      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview + Timeline (Main Area) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Player Area - Show placeholder when compiling */}
          <div className="flex-1 min-h-0 p-4">
            <div className="h-full bg-black/20 rounded-lg overflow-hidden">
              {!isReelReady ? (
                // Compiling state - show friendly placeholder
                <ReelCompilingPlaceholder
                  clipCount={reel.source_moment_ids?.length || 0}
                  aspectRatio={reel.aspect_ratio as "16:9" | "9:16" | "1:1"}
                />
              ) : (
                // Ready state - show player with effects
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
                  externalEffectsState={{
                    effects,
                    isDragging,
                    handleDrop,
                    handleEffectUpdate,
                    handleEffectDelete,
                    handleEffectDuplicate,
                  }}
                />
              )}
            </div>
          </div>

          {/* Editor Toolbar */}
          <ReelEditorToolbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showEffects={showEffects}
            onShowEffectsChange={setShowEffects}
            disabled={!isReelReady}
          />
        </div>

        {/* Right Sidebar: Tools - disabled when compiling */}
        <ReelEditorSidebar
          reelId={reel.id}
          sessionId={reel.session_id || ""}
          activeTab={activeTab}
          reelPackage={reelPackage}
          annotations={reelMoments}
          duration={duration}
          onChangesMade={() => setHasUnsavedChanges(true)}
          onDragStart={isReelReady ? handleDragStart : undefined}
          snapSettings={snapSettings}
          onSnapSettingsChange={setSnapSettings}
          effectCount={effects.length}
          onAutoEnhance={handleAutoEnhance}
          isAutoEnhancing={isAutoEnhancing}
          onClearAllEffects={effects.length > 0 ? handleClearAllEffects : undefined}
          disabled={!isReelReady}
        />
      </div>
    </div>
  );
}
