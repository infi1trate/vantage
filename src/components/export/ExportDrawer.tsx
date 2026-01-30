import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Download,
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  Link as LinkIcon,
  Video,
  Film,
  Sparkles,
  Users,
  Twitter,
  MessageCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ExportTab = "export" | "community";

export interface ExportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: ExportTab;
  sessionId: string;
  sessionTitle: string;
  onExport?: (options: ExportOptions) => void;
}

export interface ExportOptions {
  format: "mp4" | "webm" | "gif";
  quality: "high" | "medium" | "low";
  includeAnnotations: boolean;
  includeVoiceNotes: boolean;
  startTime?: number;
  endTime?: number;
}

const formatOptions = [
  { value: "mp4", label: "MP4", description: "Best compatibility", icon: Video },
  { value: "webm", label: "WebM", description: "Smaller size", icon: Film },
  { value: "gif", label: "GIF", description: "Easy sharing", icon: Sparkles },
];

const qualityOptions = [
  { value: "high", label: "High", description: "1080p" },
  { value: "medium", label: "Medium", description: "720p" },
  { value: "low", label: "Low", description: "480p" },
];

export function ExportDrawer({
  open,
  onOpenChange,
  defaultTab = "export",
  sessionId,
  sessionTitle,
  onExport,
}: ExportDrawerProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ExportTab>(defaultTab);
  const [format, setFormat] = useState<"mp4" | "webm" | "gif">("mp4");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [includeVoiceNotes, setIncludeVoiceNotes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");

  // Reset to default tab when opening
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const shareUrl = `${window.location.origin}/session/${sessionId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleExport = () => {
    const options: ExportOptions = {
      format,
      quality,
      includeAnnotations,
      includeVoiceNotes,
    };
    onExport?.(options);
    toast.success(`Exporting as ${format.toUpperCase()}...`);
    onOpenChange(false);
  };

  const handleShareSocial = (platform: string) => {
    const text = `Check out my gameplay: ${sessionTitle}`;
    let url = "";

    switch (platform) {
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "discord":
        navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success("Copied to clipboard for Discord");
        return;
    }

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExportTab)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50">
          <TabsTrigger value="export" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" />
            <span>Community</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="export" className="p-4 space-y-6 mt-0">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {formatOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(opt.value as typeof format)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        format === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-[10px] opacity-70">{opt.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Quality</Label>
              <div className="grid grid-cols-3 gap-2">
                {qualityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setQuality(opt.value as typeof quality)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                      quality === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Include</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="annotations" className="text-sm text-muted-foreground cursor-pointer">
                    Annotation overlays
                  </Label>
                  <Switch
                    id="annotations"
                    checked={includeAnnotations}
                    onCheckedChange={setIncludeAnnotations}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice" className="text-sm text-muted-foreground cursor-pointer">
                    Voice notes audio
                  </Label>
                  <Switch
                    id="voice"
                    checked={includeVoiceNotes}
                    onCheckedChange={setIncludeVoiceNotes}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="community" className="p-4 space-y-6 mt-0">
            {/* Visibility */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Visibility</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "private", label: "Private", icon: Lock },
                  { value: "unlisted", label: "Unlisted", icon: LinkIcon },
                  { value: "public", label: "Public", icon: Globe },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setVisibility(opt.value as typeof visibility)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        visibility === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Share Link */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="text-xs bg-muted/50 font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Social Sharing */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Share to</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleShareSocial("twitter")}
                >
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleShareSocial("discord")}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Discord</span>
                </Button>
              </div>
            </div>

            {/* Community Features Placeholder */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Community features coming soon
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Share clips, get feedback, find teammates
              </p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer with action button */}
      <div className="p-4 border-t border-border/50 bg-background/80">
        {activeTab === "export" ? (
          <Button onClick={handleExport} className="w-full gap-2" size="lg">
            <Download className="h-4 w-4" />
            <span>Export {format.toUpperCase()}</span>
          </Button>
        ) : (
          <Button onClick={handleCopyLink} className="w-full gap-2" size="lg">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? "Copied!" : "Copy Share Link"}</span>
          </Button>
        )}
      </div>
    </div>
  );

  // Use Dialog for desktop, Drawer for mobile
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg font-display">Export & Share</DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground truncate">
              {sessionTitle}
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-lg font-display">Export & Share</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground truncate">
            {sessionTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-hidden">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
