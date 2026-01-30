import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJobs, useCurrentJob } from "@/contexts/JobsContext";
import { ExportJob } from "@/lib/exportJobs";
import {
  Download,
  Share2,
  Users,
  MonitorPlay,
  Film,
  Music,
  Mic,
  Camera,
  Captions,
  Globe,
  Lock,
  Link as LinkIcon,
  Youtube,
  Play,
  Plus,
  Gamepad2,
  Clock,
  HardDrive,
  MessageSquare,
  Pencil,
  Shuffle,
  X,
  Loader2,
  Check,
  AlertCircle,
  Minimize2,
  RefreshCw,
  Zap,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToDesktop, generateExportFilename } from "@/lib/fileExport";

export type ExportTab = "download" | "platforms" | "community";

export interface ExportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: ExportTab;
  sessionId: string;
  sessionTitle: string;
  sessionThumbnail?: string;
  sessionDuration?: number;
  // Video source for export
  videoUrl?: string;
  videoBlob?: Blob;
  // Track availability
  hasMicTrack?: boolean;
  hasWebcamTrack?: boolean;
  hasCaptions?: boolean;
  onExport?: (options: ExportOptions) => void;
  onPublish?: (options: PublishOptions) => void;
}

export interface ExportOptions {
  preset: "source" | "1080p" | "720p" | "audio";
  format: "mp4" | "mov" | "mp3" | "wav";
  includeMic: boolean;
  includeWebcam: boolean;
  burnCaptions: boolean;
}

export interface PublishOptions {
  platform: string;
  title: string;
  description: string;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  allowComments: boolean;
  allowAnnotations: boolean;
  allowRemixes: boolean;
}

// Preset configurations
const presets = [
  { 
    value: "source", 
    label: "Source", 
    sublabel: "Original", 
    description: "Full quality, largest file",
    icon: MonitorPlay,
  },
  { 
    value: "1080p", 
    label: "1080p", 
    sublabel: "Recommended", 
    description: "Great for sharing",
    icon: Film,
    recommended: true,
  },
  { 
    value: "720p", 
    label: "720p", 
    sublabel: "", 
    description: "Smaller file size",
    icon: Film,
  },
  { 
    value: "audio", 
    label: "Audio only", 
    sublabel: "MP3", 
    description: "Voice commentary export",
    icon: Music,
  },
];

// Platform destinations
const platforms = [
  { id: "youtube", name: "YouTube", icon: Youtube, color: "text-red-500" },
  { id: "tiktok", name: "TikTok", icon: Play, color: "text-foreground" },
  { id: "medal", name: "Medal", icon: Gamepad2, color: "text-yellow-500" },
  { id: "twitch", name: "Twitch", icon: Play, color: "text-purple-500" },
];

// Suggested gaming tags
const suggestedTags = [
  "gameplay", "highlights", "clutch", "funny", "tutorial", 
  "ranked", "competitive", "montage", "tips", "review"
];

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function estimateFileSize(duration: number, preset: string): string {
  // Rough estimates in MB per minute
  const rates: Record<string, number> = {
    source: 150,
    "1080p": 50,
    "720p": 25,
    audio: 1,
  };
  const rate = rates[preset] || 50;
  const sizeMB = (duration / 60) * rate;
  if (sizeMB >= 1000) {
    return `~${(sizeMB / 1000).toFixed(1)} GB`;
  }
  return `~${Math.round(sizeMB)} MB`;
}

export function ExportDrawer({
  open,
  onOpenChange,
  defaultTab = "download",
  sessionId,
  sessionTitle,
  sessionThumbnail,
  sessionDuration = 300,
  videoUrl,
  videoBlob,
  hasMicTrack = false,
  hasWebcamTrack = false,
  hasCaptions = false,
  onExport,
  onPublish,
}: ExportDrawerProps) {
  const isMobile = useIsMobile();
  const { startJob, cancelJob, retryJob, setCurrentJobId } = useJobs();
  const currentJob = useCurrentJob();
  
  const [activeTab, setActiveTab] = useState<ExportTab>(defaultTab);
  const [showProgress, setShowProgress] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Download tab state
  const [preset, setPreset] = useState<"source" | "1080p" | "720p" | "audio">("1080p");
  const [format, setFormat] = useState<"mp4" | "mov" | "mp3" | "wav">("mp4");
  const [includeMic, setIncludeMic] = useState(hasMicTrack);
  const [includeWebcam, setIncludeWebcam] = useState(hasWebcamTrack);
  const [burnCaptions, setBurnCaptions] = useState(false);

  // Community tab state
  const [title, setTitle] = useState(sessionTitle);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowAnnotations, setAllowAnnotations] = useState(false);
  const [allowRemixes, setAllowRemixes] = useState(false);

  // Fast export mode (no transcoding available)
  const isFastExport = true; // TODO: Check for transcoding capability

  // Reset to default tab when opening
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setShowProgress(false);
      setCurrentJobId(null);
    }
  }, [open, defaultTab, setCurrentJobId]);

  // Show progress when job starts
  useEffect(() => {
    if (currentJob && (currentJob.status === "pending" || currentJob.status === "processing")) {
      setShowProgress(true);
    }
  }, [currentJob]);

  // Update format when preset changes
  useEffect(() => {
    if (preset === "audio") {
      setFormat("mp3");
    } else {
      setFormat("mp4");
    }
  }, [preset]);

  const handleExport = async () => {
    if (!videoUrl && !videoBlob) {
      console.error("[Export] No video source available");
      return;
    }
    
    setIsExporting(true);
    
    // Start a job for tracking
    const job = startJob("desktop_export", sessionId, sessionTitle, {
      preset,
      format,
      includeMic,
      includeWebcam,
      burnCaptions,
      isFastExport,
    });
    setShowProgress(true);
    
    try {
      // Perform the actual file download
      const result = await exportToDesktop({
        videoUrl,
        videoBlob,
        title: sessionTitle,
        format: preset === "audio" ? (format as "mp3" | "wav") : (format as "mp4" | "mov"),
        onProgress: (stage, progress) => {
          console.log(`[Export] ${stage}: ${Math.round(progress * 100)}%`);
        },
      });
      
      console.log("[Export] Download started:", result.filename);
      
      // Notify parent
      onExport?.({
        preset,
        format,
        includeMic,
        includeWebcam,
        burnCaptions,
      });
    } catch (error) {
      console.error("[Export] Failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddTag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();
    if (cleanTag && !tags.includes(cleanTag) && tags.length < 10) {
      setTags([...tags, cleanTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handlePublish = () => {
    // Start a community post job
    startJob("community_post", sessionId, sessionTitle, {
      title: title.trim(),
      description: description.trim(),
      tags,
      visibility,
      allowComments,
      allowAnnotations,
      allowRemixes,
    });
    setShowProgress(true);
    onPublish?.({
      platform: "vantage",
      title: title.trim(),
      description: description.trim(),
      tags,
      visibility,
      allowComments,
      allowAnnotations,
      allowRemixes,
    });
  };

  const handleMinimize = () => {
    onOpenChange(false);
  };

  const handleCancelJob = () => {
    if (currentJob) {
      cancelJob(currentJob.id);
      setShowProgress(false);
      setCurrentJobId(null);
    }
  };

  const handleRetryJob = () => {
    if (currentJob) {
      retryJob(currentJob.id);
    }
  };

  const handleCloseProgress = () => {
    setShowProgress(false);
    setCurrentJobId(null);
    if (currentJob?.status === "completed") {
      onOpenChange(false);
    }
  };

  // Progress panel content
  const progressContent = currentJob && showProgress ? (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentJob.status === "processing" || currentJob.status === "pending" ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : currentJob.status === "completed" ? (
              <div className="p-1 rounded-full bg-primary/10">
                <Check className="h-4 w-4 text-primary" />
              </div>
            ) : (
              <div className="p-1 rounded-full bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
            )}
            <span className="font-display text-lg tracking-wide">
              {currentJob.status === "completed" ? "COMPLETE" : 
               currentJob.status === "failed" ? "FAILED" :
               currentJob.status === "cancelled" ? "CANCELLED" :
               "EXPORTING"}
            </span>
          </div>
        </div>

        {/* Session info */}
        <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
          <p className="text-sm font-medium truncate">{currentJob.sessionTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentJob.config.preset} • {currentJob.config.format?.toUpperCase()}
          </p>
        </div>

        {/* Progress stages */}
        <div className="space-y-3">
          {currentJob.stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                stage.status === "completed" && "bg-primary text-primary-foreground",
                stage.status === "active" && "bg-primary/20 text-primary border-2 border-primary",
                stage.status === "pending" && "bg-muted text-muted-foreground",
                stage.status === "failed" && "bg-destructive text-destructive-foreground"
              )}>
                {stage.status === "completed" ? (
                  <Check className="h-3 w-3" />
                ) : stage.status === "active" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : stage.status === "failed" ? (
                  <X className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={cn(
                "text-sm",
                stage.status === "active" && "text-primary font-medium",
                stage.status === "completed" && "text-foreground",
                stage.status === "pending" && "text-muted-foreground",
                stage.status === "failed" && "text-destructive"
              )}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error message */}
        {currentJob.status === "failed" && currentJob.errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{currentJob.errorMessage}</p>
          </div>
        )}

        {/* Success results */}
        {currentJob.status === "completed" && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            {currentJob.outputPath && (
              <p className="text-sm">
                <span className="text-muted-foreground">Saved to:</span>{" "}
                <span className="font-mono text-xs">{currentJob.outputPath}</span>
              </p>
            )}
            {currentJob.shareLink && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(currentJob.shareLink!);
                }}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Copy Link
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/30 bg-background/95">
        {(currentJob.status === "pending" || currentJob.status === "processing") && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleMinimize}
            >
              <Minimize2 className="h-4 w-4" />
              Run in background
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancelJob}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}
        
        {currentJob.status === "completed" && (
          <Button onClick={handleCloseProgress} className="w-full gap-2">
            <Check className="h-4 w-4" />
            Done
          </Button>
        )}
        
        {currentJob.status === "failed" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCloseProgress}
            >
              Close
            </Button>
            {currentJob.retryCount < currentJob.maxRetries && (
              <Button
                className="flex-1 gap-2"
                onClick={handleRetryJob}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            )}
          </div>
        )}
        
        {currentJob.status === "cancelled" && (
          <Button variant="outline" onClick={handleCloseProgress} className="w-full">
            Close
          </Button>
        )}
      </div>
    </div>
  ) : null;

  const content = (
    <div className="flex flex-col h-full">
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => setActiveTab(v as ExportTab)} 
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
          <TabsTrigger 
            value="download" 
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </TabsTrigger>
          <TabsTrigger 
            value="platforms" 
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Platforms</span>
          </TabsTrigger>
          <TabsTrigger 
            value="community" 
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Community</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          {/* Download Tab */}
          <TabsContent value="download" className="p-4 space-y-5 mt-0 data-[state=inactive]:hidden">
            {/* Export Preset */}
            <div className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Export Preset
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => {
                  const Icon = p.icon;
                  const isSelected = preset === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPreset(p.value as typeof preset)}
                      className={cn(
                        "relative flex flex-col items-start gap-1 p-3 rounded-lg border transition-all text-left",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      {p.recommended && (
                        <Badge className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0 h-4 bg-primary">
                          Best
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("font-medium text-sm", isSelected && "text-primary")}>
                          {p.label}
                        </span>
                        {p.sublabel && (
                          <span className="text-[10px] text-muted-foreground">
                            {p.sublabel}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{p.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format Picker */}
            <div className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Format
              </Label>
              <div className="flex gap-2">
                {preset === "audio" ? (
                  <>
                    <button
                      onClick={() => setFormat("mp3")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                        format === "mp3"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 hover:border-border text-muted-foreground"
                      )}
                    >
                      MP3
                    </button>
                    <button
                      onClick={() => setFormat("wav")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                        format === "wav"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 hover:border-border text-muted-foreground"
                      )}
                    >
                      WAV
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setFormat("mp4")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                        format === "mp4"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 hover:border-border text-muted-foreground"
                      )}
                    >
                      MP4
                    </button>
                    <button
                      onClick={() => setFormat("mov")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                        format === "mov"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 hover:border-border text-muted-foreground"
                      )}
                    >
                      MOV
                    </button>
                  </>
                )}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Toggles */}
            <div className="space-y-3">
              {/* Mic toggle - show disabled if no mic track */}
              {preset !== "audio" && (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Mic className={cn("h-4 w-4", hasMicTrack ? "text-muted-foreground" : "text-muted-foreground/40")} />
                    <div>
                      <Label 
                        htmlFor="mic" 
                        className={cn("text-sm", !hasMicTrack && "text-muted-foreground/60 cursor-not-allowed")}
                      >
                        Include microphone audio
                      </Label>
                      {!hasMicTrack && (
                        <p className="text-[10px] text-muted-foreground/50">No microphone recorded</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id="mic"
                    checked={includeMic}
                    onCheckedChange={setIncludeMic}
                    disabled={!hasMicTrack}
                  />
                </div>
              )}

              {/* Webcam toggle - show disabled if no webcam track */}
              {preset !== "audio" && (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Camera className={cn("h-4 w-4", hasWebcamTrack ? "text-muted-foreground" : "text-muted-foreground/40")} />
                    <div>
                      <Label 
                        htmlFor="webcam" 
                        className={cn("text-sm", !hasWebcamTrack && "text-muted-foreground/60 cursor-not-allowed")}
                      >
                        Include webcam overlay
                      </Label>
                      {!hasWebcamTrack && (
                        <p className="text-[10px] text-muted-foreground/50">No webcam recorded</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id="webcam"
                    checked={includeWebcam}
                    onCheckedChange={setIncludeWebcam}
                    disabled={!hasWebcamTrack}
                  />
                </div>
              )}

              {/* Captions toggle - show disabled if no captions */}
              {preset !== "audio" && (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Captions className={cn("h-4 w-4", hasCaptions ? "text-muted-foreground" : "text-muted-foreground/40")} />
                    <div>
                      <Label 
                        htmlFor="captions" 
                        className={cn("text-sm", !hasCaptions && "text-muted-foreground/60 cursor-not-allowed")}
                      >
                        Burn in captions
                      </Label>
                      {!hasCaptions && (
                        <p className="text-[10px] text-muted-foreground/50">No captions available</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id="captions"
                    checked={burnCaptions}
                    onCheckedChange={setBurnCaptions}
                    disabled={!hasCaptions}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="p-4 space-y-4 mt-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.id}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all group"
                  >
                    <div className={cn(
                      "p-3 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors",
                      platform.color
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">{platform.name}</span>
                  </button>
                );
              })}
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border/50 hover:border-primary/50 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
              <span className="text-sm">More platforms...</span>
            </button>

            <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
              <p className="text-xs text-muted-foreground text-center">
                Connect your accounts to publish directly from Vantage
              </p>
            </div>
          </TabsContent>

          {/* Community Tab */}
          <TabsContent value="community" className="p-4 space-y-4 mt-0 data-[state=inactive]:hidden">
            {/* Preview Card */}
            <div className="flex gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
              <div className="w-24 aspect-video rounded-md bg-muted/50 overflow-hidden shrink-0">
                {sessionThumbnail ? (
                  <img src={sessionThumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gamepad2 className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{title || "Untitled"}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(sessionDuration)}</span>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your post a title"
                maxLength={100}
                className="bg-muted/30 border-border/50"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)"
                maxLength={500}
                rows={3}
                className="bg-muted/30 border-border/50 resize-none"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tags
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 p-0.5 rounded hover:bg-destructive/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                {tags.length < 10 && (
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => tagInput && handleAddTag(tagInput)}
                    placeholder={tags.length === 0 ? "Add tags..." : "+"}
                    className="h-6 w-20 text-xs px-2 bg-transparent border-dashed"
                  />
                )}
              </div>
              {/* Suggested tags */}
              {tags.length < 5 && (
                <div className="flex flex-wrap gap-1">
                  {suggestedTags
                    .filter(t => !tags.includes(t))
                    .slice(0, 5)
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Visibility
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "public", label: "Public", icon: Globe },
                  { value: "unlisted", label: "Unlisted", icon: LinkIcon },
                  { value: "private", label: "Private", icon: Lock },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setVisibility(opt.value as typeof visibility)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-2.5 rounded-lg border transition-all",
                        visibility === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Community Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="comments" className="text-sm cursor-pointer">
                    Allow comments
                  </Label>
                </div>
                <Switch
                  id="comments"
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                />
              </div>

              <div className="flex items-start justify-between py-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="annotations" className="text-sm cursor-pointer">
                      Allow public annotations
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
                    Let the community add timestamped notes
                  </p>
                </div>
                <Switch
                  id="annotations"
                  checked={allowAnnotations}
                  onCheckedChange={setAllowAnnotations}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Shuffle className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="remixes" className="text-sm cursor-pointer">
                    Allow public clip remixes
                  </Label>
                </div>
                <Switch
                  id="remixes"
                  checked={allowRemixes}
                  onCheckedChange={setAllowRemixes}
                />
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer with action button */}
      <div className="p-4 border-t border-border/30 bg-background/95 backdrop-blur-sm">
        {activeTab === "download" && (
          <div className="space-y-3">
            {/* Fast export indicator */}
            {isFastExport && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>Fast export</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-0.5 hover:bg-muted rounded">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">Exports the existing file without re-encoding. Original quality preserved.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            {/* File info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                <span>{estimateFileSize(sessionDuration, preset)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDuration(sessionDuration)}</span>
              </div>
            </div>
            <Button 
              onClick={handleExport} 
              className="w-full gap-2" 
              size="lg"
              disabled={isExporting || (!videoUrl && !videoBlob)}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Export to Desktop</span>
                </>
              )}
            </Button>
            {!videoUrl && !videoBlob && (
              <p className="text-xs text-muted-foreground text-center">
                Video not available for export
              </p>
            )}
          </div>
        )}
        
        {activeTab === "platforms" && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Select a platform to continue
          </p>
        )}
        
        {activeTab === "community" && (
          <Button 
            onClick={handlePublish} 
            className="w-full gap-2" 
            size="lg"
            disabled={!title.trim()}
          >
            <Users className="h-4 w-4" />
            <span>Post to Community</span>
          </Button>
        )}
      </div>
    </div>
  );

  // Determine which content to show
  const displayContent = showProgress && currentJob ? progressContent : content;
  const displayTitle = showProgress && currentJob 
    ? (currentJob.status === "completed" ? "COMPLETE" : 
       currentJob.status === "failed" ? "FAILED" : "EXPORTING")
    : "EXPORT";
  const displayDescription = showProgress && currentJob
    ? currentJob.sessionTitle
    : "Publish or save your video";

  // Use Drawer for mobile, Sheet for desktop
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="pb-0 text-left">
            <DrawerTitle className="font-display text-xl tracking-wide">
              {displayTitle}
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground truncate">
              {displayDescription}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-hidden">{displayContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[440px] p-0 flex flex-col gap-0">
        <SheetHeader className="p-4 pb-0 text-left">
          <SheetTitle className="font-display text-xl tracking-wide">
            {displayTitle}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground truncate">
            {displayDescription}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">{displayContent}</div>
      </SheetContent>
    </Sheet>
  );
}
