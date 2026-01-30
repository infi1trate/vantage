import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  Bug, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Monitor,
  Mic,
  Camera,
  HardDrive,
  Copy,
  Check
} from "lucide-react";
import type { CaptureState } from "@/hooks/useCaptureManager";
import type { RecordedSourceType } from "@/lib/localSessionStorage";
import type { RecordingMimeTypeInfo } from "@/lib/recordingMimeTypes";
import { getAllMimeTypeSupportStatus } from "@/lib/recordingMimeTypes";
import { toast } from "sonner";

interface CaptureDiagnosticsProps {
  captureState: CaptureState;
  screenStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  facecamStream: MediaStream | null;
  duration: number;
  error: { code: string; message: string; details?: string } | null;
  recorderState?: RecordingState;
  chunksCount?: number;
  totalBytes?: number;
  mimeTypeInfo?: RecordingMimeTypeInfo;
  recordedSource?: RecordedSourceType;
  /** Log of MediaRecorder state transitions */
  recorderStateLog?: string[];
  /** Last MediaRecorder error event */
  lastRecorderError?: string | null;
}

interface TrackDiagnostics {
  count: number;
  readyState: string;
  enabled: boolean;
  muted: boolean;
  label: string;
  width?: number;
  height?: number;
  frameRate?: number;
  sampleRate?: number;
  channelCount?: number;
}

function getStreamTrackDiagnostics(stream: MediaStream | null, type: "video" | "audio"): TrackDiagnostics | null {
  if (!stream) return null;
  
  const tracks = type === "video" ? stream.getVideoTracks() : stream.getAudioTracks();
  if (tracks.length === 0) return null;
  
  const track = tracks[0];
  const settings = track.getSettings();
  
  return {
    count: tracks.length,
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    label: track.label,
    width: settings.width,
    height: settings.height,
    frameRate: settings.frameRate,
    sampleRate: settings.sampleRate,
    channelCount: settings.channelCount,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const stateColors: Record<CaptureState, string> = {
  idle: "bg-muted text-muted-foreground",
  selecting_sources: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  preview_ready: "bg-vantage-success/20 text-vantage-success border-vantage-success/30",
  starting: "bg-warning/20 text-warning border-warning/30",
  recording: "bg-destructive/20 text-destructive border-destructive/30",
  paused: "bg-warning/20 text-warning border-warning/30",
  finalizing: "bg-primary/20 text-primary border-primary/30",
  saved: "bg-vantage-success/20 text-vantage-success border-vantage-success/30",
  error: "bg-destructive/20 text-destructive border-destructive/30",
};

export function CaptureDiagnostics({
  captureState,
  screenStream,
  microphoneStream,
  facecamStream,
  duration,
  error,
  recorderState,
  chunksCount = 0,
  totalBytes = 0,
  mimeTypeInfo,
  recordedSource,
  recorderStateLog = [],
  lastRecorderError,
}: CaptureDiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mimeTypeSupport, setMimeTypeSupport] = useState<ReturnType<typeof getAllMimeTypeSupportStatus> | null>(null);

  useEffect(() => {
    setMimeTypeSupport(getAllMimeTypeSupportStatus());
  }, []);

  // Gather all track diagnostics
  const screenVideo = getStreamTrackDiagnostics(screenStream, "video");
  const screenAudio = getStreamTrackDiagnostics(screenStream, "audio");
  const micAudio = getStreamTrackDiagnostics(microphoneStream, "audio");
  const camVideo = getStreamTrackDiagnostics(facecamStream, "video");

  // Browser capabilities
  const capabilities = {
    isSecureContext: window.isSecureContext,
    mediaRecorder: typeof MediaRecorder !== "undefined",
    getDisplayMedia: !!(navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices),
    getUserMedia: !!(navigator.mediaDevices && "getUserMedia" in navigator.mediaDevices),
    audioContext: typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined",
    indexedDB: typeof indexedDB !== "undefined",
  };

  // Generate full diagnostics object for copying
  const generateDiagnosticsText = useCallback(() => {
    const diag = {
      timestamp: new Date().toISOString(),
      environment: {
        isSecureContext: window.isSecureContext,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
      capabilities,
      mimeTypeSupport: mimeTypeSupport?.map(m => ({
        type: m.mimeType,
        record: m.canRecord,
        playback: m.canPlayback,
        compatible: m.compatible,
      })),
      selectedFormat: mimeTypeInfo ? {
        mimeType: mimeTypeInfo.mimeType,
        fileExt: mimeTypeInfo.fileExt,
        codecs: mimeTypeInfo.codecsLabel,
        browser: mimeTypeInfo.browserLabel,
      } : null,
      captureState,
      recorderState: recorderState || null,
      recorderStateLog,
      tracks: {
        display: screenVideo ? {
          videoCount: screenVideo.count,
          videoReadyState: screenVideo.readyState,
          resolution: screenVideo.width && screenVideo.height ? `${screenVideo.width}x${screenVideo.height}` : null,
          frameRate: screenVideo.frameRate,
        } : null,
        displayAudio: screenAudio ? {
          count: screenAudio.count,
          readyState: screenAudio.readyState,
          muted: screenAudio.muted,
        } : null,
        microphone: micAudio ? {
          count: micAudio.count,
          readyState: micAudio.readyState,
          enabled: micAudio.enabled,
          muted: micAudio.muted,
          sampleRate: micAudio.sampleRate,
          channelCount: micAudio.channelCount,
        } : null,
        webcam: camVideo ? {
          count: camVideo.count,
          readyState: camVideo.readyState,
          resolution: camVideo.width && camVideo.height ? `${camVideo.width}x${camVideo.height}` : null,
          frameRate: camVideo.frameRate,
        } : null,
      },
      recording: {
        duration,
        chunksCount,
        totalBytes,
        formattedSize: formatBytes(totalBytes),
        recordedSource,
      },
      error: error ? {
        code: error.code,
        message: error.message,
        details: error.details,
      } : null,
      lastRecorderError,
    };
    
    return JSON.stringify(diag, null, 2);
  }, [
    capabilities, mimeTypeSupport, mimeTypeInfo, captureState, recorderState,
    recorderStateLog, screenVideo, screenAudio, micAudio, camVideo,
    duration, chunksCount, totalBytes, recordedSource, error, lastRecorderError
  ]);

  const handleCopyDiagnostics = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateDiagnosticsText());
      setCopied(true);
      toast.success("Diagnostics copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy diagnostics");
    }
  }, [generateDiagnosticsText]);

  const StatusIcon = ({ ok }: { ok: boolean }) => 
    ok ? <CheckCircle2 className="h-3 w-3 text-vantage-success" /> : <XCircle className="h-3 w-3 text-destructive" />;

  const TrackStatus = ({ 
    label, 
    icon: Icon, 
    track,
    showMuted = false 
  }: { 
    label: string; 
    icon: typeof Monitor; 
    track: TrackDiagnostics | null;
    showMuted?: boolean;
  }) => (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs">{label}</span>
      </div>
      {track ? (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            {track.count} track{track.count !== 1 ? "s" : ""}
          </span>
          <Badge 
            variant="outline" 
            className={track.readyState === "live" 
              ? "bg-vantage-success/20 text-vantage-success border-vantage-success/30 text-[10px]" 
              : "bg-destructive/20 text-destructive border-destructive/30 text-[10px]"
            }
          >
            {track.readyState}
          </Badge>
          {showMuted && (
            <Badge 
              variant="outline" 
              className={track.muted 
                ? "bg-destructive/20 text-destructive border-destructive/30 text-[10px]" 
                : "bg-vantage-success/20 text-vantage-success border-vantage-success/30 text-[10px]"
              }
            >
              {track.muted ? "muted" : "unmuted"}
            </Badge>
          )}
          {track.width && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {track.width}×{track.height}
              {track.frameRate && `@${Math.round(track.frameRate)}fps`}
            </span>
          )}
        </div>
      ) : (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">none</Badge>
      )}
    </div>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-muted-foreground/30 bg-muted/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Capture Diagnostics
              </span>
              {error && (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              )}
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-4 text-sm">
            {/* Copy Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDiagnostics}
                className="h-7 text-xs gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy Diagnostics
                  </>
                )}
              </Button>
            </div>

            {/* Environment */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Environment
              </h4>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <StatusIcon ok={capabilities.isSecureContext} />
                  <span className="text-xs">isSecureContext</span>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] ml-auto ${capabilities.isSecureContext ? "text-vantage-success" : "text-destructive"}`}
                  >
                    {capabilities.isSecureContext ? "true" : "false"}
                  </Badge>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground break-all bg-muted/30 rounded p-1.5">
                  {navigator.userAgent}
                </div>
              </div>
            </div>

            {/* Browser Support */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Browser APIs
              </h4>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1.5">
                  <StatusIcon ok={capabilities.mediaRecorder} />
                  <span className="text-xs">MediaRecorder</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon ok={capabilities.getDisplayMedia} />
                  <span className="text-xs">getDisplayMedia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon ok={capabilities.getUserMedia} />
                  <span className="text-xs">getUserMedia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon ok={capabilities.audioContext} />
                  <span className="text-xs">AudioContext</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon ok={capabilities.indexedDB} />
                  <span className="text-xs">IndexedDB</span>
                </div>
              </div>
            </div>

            {/* MIME Type Support Matrix */}
            {mimeTypeSupport && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Format Compatibility (isTypeSupported)
                </h4>
                <div className="space-y-1">
                  {mimeTypeSupport.map(({ mimeType, canRecord, canPlayback, compatible }) => (
                    <div key={mimeType} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {mimeType}
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${canRecord ? "text-vantage-success border-vantage-success/30" : "text-destructive border-destructive/30"}`}
                        >
                          rec {canRecord ? "✓" : "✗"}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${canPlayback ? "text-vantage-success border-vantage-success/30" : "text-destructive border-destructive/30"}`}
                        >
                          play {canPlayback ? "✓" : "✗"}
                        </Badge>
                        {compatible && (
                          <Badge 
                            variant="outline" 
                            className="text-[9px] bg-vantage-success/20 text-vantage-success border-vantage-success/30"
                          >
                            ✓
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Selected MIME Type */}
            {mimeTypeInfo && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Selected Format
                </h4>
                <div className="p-2 bg-vantage-success/10 rounded border border-vantage-success/30">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-vantage-success" />
                    <span className="text-xs font-mono text-vantage-success">{mimeTypeInfo.mimeType}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span>Codecs: {mimeTypeInfo.codecsLabel}</span>
                    <span>•</span>
                    <span>File: .{mimeTypeInfo.fileExt}</span>
                    <span>•</span>
                    <span>{mimeTypeInfo.browserLabel}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Current State */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Capture State
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={stateColors[captureState]}>
                  {captureState}
                </Badge>
                {recorderState && (
                  <Badge variant="outline" className="text-xs">
                    MediaRecorder: {recorderState}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  {duration}s
                </span>
              </div>
            </div>

            {/* MediaRecorder State Log */}
            {recorderStateLog.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Recorder State Log
                </h4>
                <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 rounded p-2 max-h-24 overflow-y-auto space-y-0.5">
                  {recorderStateLog.map((entry, i) => (
                    <div key={i}>{entry}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Tracks */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Active Tracks
              </h4>
              <div className="space-y-0.5">
                <TrackStatus label="Display Video" icon={Monitor} track={screenVideo} />
                <TrackStatus label="Display Audio" icon={Monitor} track={screenAudio} showMuted />
                <TrackStatus label="Microphone" icon={Mic} track={micAudio} showMuted />
                <TrackStatus label="Webcam" icon={Camera} track={camVideo} />
              </div>
            </div>

            {/* Recording Stats */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Recording Stats
              </h4>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono">{chunksCount} chunks</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatBytes(totalBytes)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Source:</span>
                  <Badge 
                    variant="outline" 
                    className={
                      recordedSource === "composed" 
                        ? "bg-vantage-success/20 text-vantage-success border-vantage-success/30 text-xs" 
                        : recordedSource === "screenOnly"
                        ? "bg-warning/20 text-warning border-warning/30 text-xs"
                        : "bg-muted text-muted-foreground text-xs"
                    }
                  >
                    {recordedSource === "composed" && "✓ Composed (Canvas + Mixed Audio)"}
                    {recordedSource === "screenOnly" && "⚠ Screen Only"}
                    {!recordedSource && captureState === "recording" && "composed (active)"}
                    {!recordedSource && captureState !== "recording" && "–"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Last Recorder Error */}
            {lastRecorderError && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-destructive mb-2">
                  Last MediaRecorder Error
                </h4>
                <div className="p-2 bg-destructive/10 rounded border border-destructive/30">
                  <p className="text-xs font-mono text-destructive break-all">
                    {lastRecorderError}
                  </p>
                </div>
              </div>
            )}

            {/* App Error */}
            {error && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-destructive mb-2">
                  Capture Error
                </h4>
                <div className="p-2 bg-destructive/10 rounded border border-destructive/30 space-y-1">
                  <p className="text-xs font-mono text-destructive">
                    [{error.code}] {error.message}
                  </p>
                  {error.details && (
                    <p className="text-[10px] font-mono text-destructive/70 break-all">
                      {error.details}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
