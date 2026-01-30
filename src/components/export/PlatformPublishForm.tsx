/**
 * Platform Publish Forms
 * Per-platform forms with specific fields and fallback manual upload flow
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Youtube,
  Music2,
  Medal,
  Twitch,
  ArrowLeft,
  Globe,
  Lock,
  Link as LinkIcon,
  Users,
  Copy,
  ExternalLink,
  Download,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlatformId,
  PLATFORMS,
  ConnectedAccount,
  requiresManualUpload,
  copyToClipboard,
  openUploadPage,
} from "@/lib/platformConnections";
import { useJobs } from "@/contexts/JobsContext";
import { toast } from "sonner";

// Platform icons map
const PLATFORM_ICONS: Record<PlatformId, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  tiktok: Music2,
  medal: Medal,
  twitch: Twitch,
  twitter: () => <span className="text-lg font-bold">𝕏</span>,
  instagram: () => <span className="text-lg">📷</span>,
  facebook: () => <span className="text-lg">f</span>,
  discord: () => <span className="text-lg">💬</span>,
};

interface PlatformPublishFormProps {
  platformId: PlatformId;
  account: ConnectedAccount | null;
  sessionId: string;
  sessionTitle: string;
  sessionDuration?: number;
  videoUrl?: string;
  videoBlob?: Blob;
  onBack: () => void;
  onClose: () => void;
}

export function PlatformPublishForm({
  platformId,
  account,
  sessionId,
  sessionTitle,
  sessionDuration = 0,
  videoUrl,
  videoBlob,
  onBack,
  onClose,
}: PlatformPublishFormProps) {
  const platform = PLATFORMS[platformId];
  const Icon = PLATFORM_ICONS[platformId];
  const { startJob } = useJobs();
  const isManualUpload = requiresManualUpload(platformId);

  // Form state
  const [title, setTitle] = useState(sessionTitle);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState(
    platform.visibilityOptions?.[0] || "public"
  );
  const [allowComments, setAllowComments] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // Manual upload flow state
  const [manualUploadStep, setManualUploadStep] = useState<"form" | "exporting" | "ready">("form");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleCopy = async (field: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      toast.success(`${field} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleOpenUploadPage = () => {
    openUploadPage(platformId);
  };

  const handlePublish = () => {
    if (isManualUpload) {
      // Start export + manual upload flow
      setManualUploadStep("exporting");
      
      // Start a job that tracks manual upload
      startJob("platform_publish", sessionId, sessionTitle, {
        platform: platformId,
        title,
        description,
        visibility,
        allowComments,
        tags,
        requiresManualUpload: true,
      });
      
      // Simulate export completion, then show manual upload instructions
      setTimeout(() => {
        setManualUploadStep("ready");
      }, 1500);
    } else {
      // Direct API upload (future implementation)
      startJob("platform_publish", sessionId, sessionTitle, {
        platform: platformId,
        title,
        description,
        visibility,
        allowComments,
        tags,
      });
      onClose();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Manual upload ready state - show copy buttons and upload page link
  if (manualUploadStep === "ready") {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border/30">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className={cn("p-2 rounded-full bg-muted/50", platform.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Upload to {platform.name}</h3>
            <p className="text-xs text-muted-foreground">Manual upload required</p>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Success message */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Video ready for upload!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your video has been exported. Copy the details below and upload to {platform.name}.
              </p>
            </div>

            {/* Copy fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Title
                </Label>
                <div className="flex gap-2">
                  <Input value={title} readOnly className="bg-muted/30" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy("Title", title)}
                  >
                    {copiedField === "Title" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {description && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Description
                  </Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={description}
                      readOnly
                      rows={3}
                      className="bg-muted/30 resize-none"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopy("Description", description)}
                    >
                      {copiedField === "Description" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Tags
                  </Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 flex flex-wrap gap-1 p-2 rounded-md bg-muted/30 border border-input">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopy("Tags", tags.map(t => `#${t}`).join(" "))}
                    >
                      {copiedField === "Tags" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-border/30" />

            {/* Copy all button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                const fullText = [
                  title,
                  description,
                  tags.length > 0 ? `\n${tags.map(t => `#${t}`).join(" ")}` : "",
                ].filter(Boolean).join("\n\n");
                handleCopy("All details", fullText);
              }}
            >
              <Copy className="h-4 w-4" />
              Copy all details
            </Button>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/30 space-y-2">
          <Button
            className="w-full gap-2"
            onClick={handleOpenUploadPage}
          >
            <ExternalLink className="h-4 w-4" />
            Open {platform.name} Upload Page
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // Exporting state
  if (manualUploadStep === "exporting") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className={cn("p-4 rounded-full bg-muted/50 mb-4", platform.color)}>
          <Icon className="h-8 w-8" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-4" />
        <h3 className="font-semibold mb-1">Preparing for {platform.name}</h3>
        <p className="text-sm text-muted-foreground">
          Exporting your video for upload...
        </p>
      </div>
    );
  }

  // Main form
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={cn("p-2 rounded-full bg-muted/50", platform.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">Publish to {platform.name}</h3>
          {account && (
            <p className="text-xs text-muted-foreground truncate">
              {account.handle}
            </p>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Manual upload notice */}
          {isManualUpload && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Direct upload not available. We'll export your video and help you upload manually.
              </p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="platform-title" className="text-xs uppercase tracking-wider text-muted-foreground">
              Title
            </Label>
            <Input
              id="platform-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              maxLength={100}
              className="bg-muted/30 border-border/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="platform-description" className="text-xs uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="platform-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              maxLength={platformId === "youtube" ? 5000 : 2000}
              rows={4}
              className="bg-muted/30 border-border/50 resize-none"
            />
          </div>

          {/* Visibility (if supported) */}
          {platform.supportsVisibility && platform.visibilityOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Visibility
              </Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platform.visibilityOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      <div className="flex items-center gap-2">
                        {opt === "public" && <Globe className="h-4 w-4" />}
                        {opt === "unlisted" && <LinkIcon className="h-4 w-4" />}
                        {opt === "private" && <Lock className="h-4 w-4" />}
                        {opt === "friends" && <Users className="h-4 w-4" />}
                        {opt === "subscribers" && <Users className="h-4 w-4" />}
                        <span className="capitalize">{opt}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* TikTok: Allow comments */}
          {platformId === "tiktok" && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="allow-comments" className="text-sm">
                  Allow comments
                </Label>
              </div>
              <Switch
                id="allow-comments"
                checked={allowComments}
                onCheckedChange={setAllowComments}
              />
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tags
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 p-0.5 hover:bg-muted-foreground/20 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="bg-muted/30 border-border/50 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 10}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Scheduling placeholder */}
          {platform.supportsScheduling && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Schedule
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  Coming soon
                </Badge>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                disabled
              >
                <Calendar className="h-4 w-4 mr-2" />
                Publish immediately
              </Button>
            </div>
          )}

          {/* Twitch-specific note */}
          {platformId === "twitch" && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> This will upload as a Video on Demand (VOD) or Highlight depending on your Twitch settings.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border/30 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDuration(sessionDuration)}</span>
          </div>
        </div>
        <Button
          className="w-full gap-2"
          onClick={handlePublish}
          disabled={!title.trim()}
        >
          {isManualUpload ? (
            <>
              <Download className="h-4 w-4" />
              Export & Upload
            </>
          ) : (
            <>
              <Icon className="h-4 w-4" />
              Publish to {platform.name}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
