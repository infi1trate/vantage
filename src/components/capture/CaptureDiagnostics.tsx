import { useState, useEffect } from "react";
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
  HardDrive
} from "lucide-react";
import type { CaptureState } from "@/hooks/useCaptureManager";
import type { RecordedSourceType } from "@/lib/localSessionStorage";
import type { RecordingMimeTypeInfo } from "@/lib/recordingMimeTypes";
import { getAllMimeTypeSupportStatus } from "@/lib/recordingMimeTypes";

interface CaptureDiagnosticsProps {
  captureState: CaptureState;
  screenStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  facecamStream: MediaStream | null;
  duration: number;
  error: { code: string; message: string } | null;
  // Optional: expose internal recorder state if available
  recorderState?: RecordingState;
  chunksCount?: number;
  totalBytes?: number;
  /** Current MIME type info from chooseRecordingMimeType */
  mimeTypeInfo?: RecordingMimeTypeInfo;
  /** Debug: What stream source will be/was recorded */
  recordedSource?: RecordedSourceType;
}

// Browser capability detection
function detectBrowserCapabilities() {
  const capabilities = {
    mediaRecorder: typeof MediaRecorder !== "undefined",
    getDisplayMedia: !!(navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices),
    getUserMedia: !!(navigator.mediaDevices && "getUserMedia" in navigator.mediaDevices),
    audioContext: typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined",
    indexedDB: typeof indexedDB !== "undefined",
  };

  return capabilities;
}

function getTrackInfo(stream: MediaStream | null, type: "video" | "audio") {
  if (!stream) return null;
  
  const tracks = type === "video" ? stream.getVideoTracks() : stream.getAudioTracks();
  if (tracks.length === 0) return null;
  
  const track = tracks[0];
  const settings = track.getSettings();
  
  return {
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      sampleRate: settings.sampleRate,
      channelCount: settings.channelCount,
    },
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
}: CaptureDiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<ReturnType<typeof detectBrowserCapabilities> | null>(null);
  const [mimeTypeSupport, setMimeTypeSupport] = useState<ReturnType<typeof getAllMimeTypeSupportStatus> | null>(null);

  useEffect(() => {
    setCapabilities(detectBrowserCapabilities());
    setMimeTypeSupport(getAllMimeTypeSupportStatus());
  }, []);

  const screenVideo = getTrackInfo(screenStream, "video");
  const screenAudio = getTrackInfo(screenStream, "audio");
  const micAudio = getTrackInfo(microphoneStream, "audio");
  const camVideo = getTrackInfo(facecamStream, "video");

  const StatusIcon = ({ ok }: { ok: boolean }) => 
    ok ? <CheckCircle2 className="h-3 w-3 text-vantage-success" /> : <XCircle className="h-3 w-3 text-destructive" />;

  const TrackStatus = ({ label, icon: Icon, track }: { label: string; icon: typeof Monitor; track: ReturnType<typeof getTrackInfo> }) => (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs">{label}</span>
      </div>
      {track ? (
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={track.readyState === "live" 
              ? "bg-vantage-success/20 text-vantage-success border-vantage-success/30 text-[10px]" 
              : "bg-muted text-muted-foreground text-[10px]"
            }
          >
            {track.readyState}
          </Badge>
          {track.settings.width && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {track.settings.width}×{track.settings.height}
              {track.settings.frameRate && `@${Math.round(track.settings.frameRate)}fps`}
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
            {/* Browser Support */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Browser Support
              </h4>
              <div className="grid grid-cols-2 gap-1">
                {capabilities && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Mime Types with Compatibility */}
            {mimeTypeSupport && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Format Compatibility (Record + Playback)
                </h4>
                <div className="space-y-1">
                  {mimeTypeSupport.map(({ mimeType, canRecord, canPlayback, compatible }) => (
                    <div key={mimeType} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {mimeType.replace("video/", "")}
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
                Current State
              </h4>
              <div className="flex items-center gap-2">
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

            {/* Active Tracks */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Active Tracks
              </h4>
              <div className="space-y-0.5">
                <TrackStatus label="Screen Video" icon={Monitor} track={screenVideo} />
                <TrackStatus label="Screen Audio" icon={Monitor} track={screenAudio} />
                <TrackStatus label="Microphone" icon={Mic} track={micAudio} />
                <TrackStatus label="Facecam" icon={Camera} track={camVideo} />
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
                
                {/* Recorded Source indicator */}
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

            {/* Error */}
            {error && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-destructive mb-2">
                  Last Error
                </h4>
                <div className="p-2 bg-destructive/10 rounded border border-destructive/30">
                  <p className="text-xs font-mono text-destructive">
                    [{error.code}] {error.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
