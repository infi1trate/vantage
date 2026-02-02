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
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { useReel } from "@/hooks/useReel";
import { useReelAssembly } from "@/hooks/useReelAssembly";
import { useReelPackage } from "@/hooks/useReelPackageConfig";
import { useEffectsTimeline } from "@/hooks/useEffectsTimeline";
import { useClearSessionEffects } from "@/hooks/useEffectEvents";
import { useEditorState } from "@/hooks/useEditorState";
import { PlayerWithEffects } from "@/components/player/PlayerWithEffects";
import { ReelEditorToolbar } from "@/components/reel/ReelEditorToolbar";
import { ReelEditorSidebar } from "@/components/reel/ReelEditorSidebar";
import { ReelCompilingPlaceholder } from "@/components/reel/ReelCompilingPlaceholder";
import { ReelEditorIntroModal } from "@/components/reel/ReelEditorIntroModal";
import { EditorStateBadge } from "@/components/reel/EditorStateBadge";
import { PreviewUnavailableBanner } from "@/components/reel/PreviewUnavailableBanner";
import { PreviewRenderingPill } from "@/components/reel/PreviewRenderingPill";
import { ManifestPlayer } from "@/components/reel/ManifestPlayer";
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
import { ReelStatus, PreviewStatus, retryPreviewGeneration, getEffectivePlaybackMode, hasPlaybackAvailable } from "@/lib/reels";
import { supabase } from "@/integrations/supabase/client";

export default function ReelEditor() {
  const { reelId } = useParams<{ reelId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goBack: safeGoBack } = useSafeBack("/library");

  // Reel data - needed early for session-aware back navigation
  const { data: reel, isLoading: reelLoading, error: reelError } = useReel(reelId);

  // Session-aware back navigation:
  // - If reel has a session, go to session detail
  // - Otherwise fallback to library
  // - If assembling, show reassurance toast
  const goBack = useCallback(() => {
    // Show reassurance toast if leaving while assembling
    if (reel?.status === "compiling") {
      toast.info("Reel is still assembling in the background.", {
        description: "You can track progress in the queue footer.",
        duration: 5000,
      });
    }
    
    if (reel?.session_id) {
      navigate(`/session/${reel.session_id}`);
    } else {
      safeGoBack();
    }
  }, [reel?.session_id, reel?.status, navigate, safeGoBack]);

  // Session data for source video - declare early so we can use it for assembly metadata
  const [sessionData, setSessionData] = useState<{
    videoUrl: string | null;
    duration: number;
    title: string;
  } | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);

  // Reel assembly state with real-time subscription + timeout
  // Pass metadata for global render queue integration AND step tracking
  const assemblyState = useReelAssembly(
    reelId, 
    reel?.status as ReelStatus | undefined,
    {
      sessionId: reel?.session_id || undefined,
      sessionTitle: sessionData?.title || reel?.title || "Session",
      reelTitle: reel?.title || "Untitled Reel",
      aspectRatio: reel?.aspect_ratio,
      clipCount: reel?.source_moment_ids?.length,
      // Pass step tracking for truthful progress
      assemblyStep: reel?.assembly_step as import("@/lib/reels").AssemblyStep | null,
      stepStartedAt: reel?.step_started_at || null,
      assemblyAttemptId: reel?.assembly_attempt_id || null,
    }
  );
  
  // Reel package configuration
  const { config: reelPackage, isLoading: packageLoading } = useReelPackage(
    reel?.session_id || undefined
  );

  // Player state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Editor state
  const [activeTab, setActiveTab] = useState<"effects" | "frames" | "package">("effects");
  const [showEffects, setShowEffects] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isReloadingPreview, setIsReloadingPreview] = useState(false);
  
  // Derive video loaded state
  const isVideoLoaded = Boolean(sessionData?.videoUrl && duration > 0 && !loading);
  
  // Use the editor state machine with assembly state + progress
  const editorState = useEditorState(
    assemblyState.state,
    reel?.session_id || undefined,
    isVideoLoaded,
    assemblyState.progress
  );
  
  // Convenience flag for ready state
  const isReelReady = editorState.state === "ready";

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

  // Compute effective playback mode
  const effectivePlaybackMode = useMemo(() => {
    return getEffectivePlaybackMode(reel || null);
  }, [reel?.preview_url, reel?.preview_status, reel?.preview_ref]);
  
  // Check if we have playback available (no "No video" state)
  const canPlayback = useMemo(() => {
    return hasPlaybackAvailable(reel || null, sessionData?.videoUrl);
  }, [reel, sessionData?.videoUrl]);

  // Determine the best video source for stitched preview mode
  // Only used when effectivePlaybackMode === "stitched_preview"
  const getPreviewSource = useCallback(() => {
    // Use stitched preview when available
    if (effectivePlaybackMode === "stitched_preview" && reel?.preview_url) {
      return { url: reel.preview_url, isFallback: false };
    }
    // Fallback to session's source video (for PlayerWithEffects when no manifest)
    if (sessionData?.videoUrl) {
      return { url: sessionData.videoUrl, isFallback: true };
    }
    return { url: null, isFallback: false };
  }, [effectivePlaybackMode, reel?.preview_url, sessionData?.videoUrl]);

  const previewSource = getPreviewSource();

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

  // Reload preview handler
  const handleReloadPreview = useCallback(async () => {
    if (!reelId) return;
    
    setIsReloadingPreview(true);
    try {
      // Re-fetch the reel to get updated preview_url
      const { data: freshReel } = await supabase
        .from("reels")
        .select("preview_url")
        .eq("id", reelId)
        .single();
      
      if (freshReel?.preview_url) {
        // Force a refresh of the reel query
        window.location.reload();
      } else {
        toast.info("Preview still not ready. Using source video.");
      }
    } catch (err) {
      console.error("Failed to reload preview:", err);
      toast.error("Failed to reload preview");
    } finally {
      setIsReloadingPreview(false);
    }
  }, [reelId]);

  // Show preview unavailable warning when ready but using fallback
  useEffect(() => {
    if (editorState.state === "ready" && previewSource.isFallback && !previewUnavailable) {
      setPreviewUnavailable(true);
      toast.warning("Preview unavailable — export will still work.", {
        description: "Showing source video instead of assembled preview.",
        action: {
          label: "Reload preview",
          onClick: handleReloadPreview,
        },
        duration: 8000,
      });
    }
  }, [editorState.state, previewSource.isFallback, previewUnavailable, handleReloadPreview]);

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

  // Retry assembly handler
  const handleRetryAssembly = useCallback(async () => {
    setIsRetrying(true);
    try {
      await assemblyState.retry();
      toast.success("Retrying assembly...");
    } catch (err) {
      toast.error("Failed to retry assembly");
    } finally {
      setIsRetrying(false);
    }
  }, [assemblyState]);

  // Skip failing clip and retry assembly
  const handleSkipClip = useCallback(async (momentId: string) => {
    if (!reel || !reelId) return;
    
    setIsRetrying(true);
    try {
      // Remove the failing moment from source_moment_ids
      const updatedMomentIds = (reel.source_moment_ids || []).filter(id => id !== momentId);
      
      // Validate minimum clip count (need at least 1 to make a reel, but warn if only 1 left)
      if (updatedMomentIds.length === 0) {
        toast.error("Not enough clips to make a reel — select more moments.", {
          description: "This was the only clip in your reel.",
          duration: 5000,
        });
        setIsRetrying(false);
        return;
      }
      
      // Update the reel with filtered moments and reset to compiling
      const { error } = await supabase
        .from("reels")
        .update({
          source_moment_ids: updatedMomentIds,
          status: "compiling",
          assembly_step: "collecting_clips",
          render_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      if (error) throw error;
      
      toast.success(`Skipped clip — continuing with ${updatedMomentIds.length} remaining clip${updatedMomentIds.length > 1 ? 's' : ''}...`);
      
      // Trigger a retry to restart assembly
      await assemblyState.retry();
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
    } catch (err) {
      console.error("Failed to skip clip:", err);
      toast.error("Failed to skip clip — please try again.");
    } finally {
      setIsRetrying(false);
    }
  }, [reel, reelId, assemblyState, queryClient]);

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
              
              {/* Editor State Badge - always visible */}
              <EditorStateBadge
                state={editorState.state}
                statusLabel={editorState.statusLabel}
                showProgress={editorState.showProgress}
                progressPercent={editorState.progressPercent}
              />
              
              {effects.length > 0 && editorState.state === "ready" && (
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
              reelStatus={editorState.state === "compiling" ? "compiling" : reel.status as "draft" | "ready" | "rendering" | "exporting"}
              disabled={!editorState.exportEnabled}
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
          {/* Player Area - Show placeholder when not ready */}
          <div className="flex-1 min-h-0 p-4">
            <div className="h-full bg-black/20 rounded-lg overflow-hidden">
              {!editorState.previewAvailable ? (
                // Compiling/failed/needs_attention/exporting state - show friendly placeholder
                <ReelCompilingPlaceholder
                  clipCount={reel.source_moment_ids?.length || 0}
                  aspectRatio={reel.aspect_ratio as "16:9" | "9:16" | "1:1"}
                  isFailed={editorState.state === "failed"}
                  isNeedsAttention={editorState.state === "needs_attention"}
                  errorMessage={reel.render_error || assemblyState.error}
                  onRetry={assemblyState.canRetry ? handleRetryAssembly : undefined}
                  isRetrying={isRetrying}
                  onCancel={goBack}
                  onLeaveAndNotify={() => {
                    // Show reassurance toast and navigate away
                    toast.info("We'll notify you when it's ready.", {
                      description: "Your reel is still assembling in the background.",
                      duration: 5000,
                    });
                    goBack();
                  }}
                  onSkipClip={handleSkipClip}
                  // Truthful progress from assembly hook
                  progress={assemblyState.progress}
                  debugData={{
                    assemblyStep: (reel.assembly_step as import("@/components/reel/AssemblyDebugPanel").AssemblyStep) || null,
                    stepStartedAt: reel.step_started_at || null,
                    stepCompletedAt: reel.step_completed_at || null,
                    reelUpdatedAt: reel.updated_at || null,
                  }}
                />
              ) : (
                // Ready state - show player with effects
                // Uses manifest player when no preview available, otherwise PlayerWithEffects
                <div className="h-full flex flex-col">
                  {/* Show banner ONLY for failed preview - failed is actionable */}
                  {reel.preview_status === "failed" && (
                    <PreviewUnavailableBanner
                      className="mx-4 mt-4"
                      previewStatus="failed"
                      onGeneratePreview={async () => {
                        toast.info("Generating preview...", {
                          description: "This may take a moment.",
                        });
                        await retryPreviewGeneration(reelId!);
                        // Invalidate to refresh
                        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
                      }}
                    />
                  )}
                  
                  <div className="flex-1 min-h-0 relative">
                    {/* Subtle pill for rendering/pending preview - overlaid on player */}
                    {(reel.preview_status === "rendering" || reel.preview_status === "pending") && (
                      <PreviewRenderingPill 
                        previewStatus={reel.preview_status as PreviewStatus}
                      />
                    )}
                    
                    {/* Playback mode selection:
                        - "manifest" mode: Use ManifestPlayer to sequence clips
                        - "stitched_preview" mode: Use PlayerWithEffects with preview video
                        
                        Seamless switch: effectivePlaybackMode auto-updates when preview becomes ready
                    */}
                    {effectivePlaybackMode === "manifest" && reel.manifest && sessionData?.videoUrl ? (
                      <ManifestPlayer
                        manifest={reel.manifest}
                        sessionVideoUrl={sessionData.videoUrl}
                        annotations={reelMoments}
                        currentTime={currentTime}
                        onTimeUpdate={handleTimeUpdate}
                        onSeek={handleSeek}
                        onVideoLoaded={handleVideoLoaded}
                        className="h-full"
                      />
                    ) : effectivePlaybackMode === "stitched_preview" && previewSource.url ? (
                      <PlayerWithEffects
                        sessionId={reel.session_id || ""}
                        videoUrl={previewSource.url}
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
                    ) : !canPlayback ? (
                      // No playback available - show placeholder
                      <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-lg">
                        <div className="text-center p-8">
                          <Film className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                          <p className="text-muted-foreground">
                            Waiting for video...
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Preview will appear when ready
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Editor Toolbar */}
          <ReelEditorToolbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showEffects={showEffects}
            onShowEffectsChange={setShowEffects}
            disabled={!editorState.timelineInteractive}
          />
        </div>

        {/* Right Sidebar: Tools - disabled when compiling or exporting */}
        <ReelEditorSidebar
          reelId={reel.id}
          sessionId={reel.session_id || ""}
          activeTab={activeTab}
          reelPackage={reelPackage}
          annotations={reelMoments}
          duration={duration}
          onChangesMade={() => setHasUnsavedChanges(true)}
          onDragStart={editorState.fxEnabled ? handleDragStart : undefined}
          snapSettings={snapSettings}
          onSnapSettingsChange={setSnapSettings}
          effectCount={effects.length}
          onAutoEnhance={handleAutoEnhance}
          isAutoEnhancing={isAutoEnhancing}
          onClearAllEffects={effects.length > 0 ? handleClearAllEffects : undefined}
          disabled={!editorState.fxEnabled}
        />
      </div>
    </div>
  );
}
