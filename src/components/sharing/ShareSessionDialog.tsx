import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Link2,
  Copy,
  Check,
  Eye,
  Pencil,
  MessageSquare,
  Trash2,
  Clock,
  Users,
  Globe,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createSessionShare, getSessionShares, SessionShare } from "@/lib/captures";
import { formatDistanceToNow, addDays, format } from "date-fns";

interface ShareSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
}

type Permission = "view" | "annotate" | "edit";

export function ShareSessionDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
}: ShareSessionDialogProps) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<Permission>("view");
  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const [expiresDays, setExpiresDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [existingShares, setExistingShares] = useState<SessionShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    if (open && sessionId) {
      loadExistingShares();
    }
  }, [open, sessionId]);

  const loadExistingShares = async () => {
    setLoadingShares(true);
    try {
      const shares = await getSessionShares(sessionId);
      setExistingShares(shares);
    } catch (error) {
      console.error("Error loading shares:", error);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleCreateShare = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const expiresAt = expiresEnabled
        ? addDays(new Date(), expiresDays).toISOString()
        : undefined;

      const share = await createSessionShare(
        sessionId,
        user.id,
        undefined, // Public link, no specific user
        permission,
        expiresAt
      );

      const shareUrl = `${window.location.origin}/session/${sessionId}?token=${share.share_token}`;
      setGeneratedLink(shareUrl);
      setExistingShares((prev) => [share, ...prev]);
      toast.success("Share link created!");
    } catch (error) {
      console.error("Error creating share:", error);
      toast.error("Failed to create share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const getPermissionIcon = (perm: Permission) => {
    switch (perm) {
      case "view":
        return <Eye className="h-4 w-4" />;
      case "annotate":
        return <MessageSquare className="h-4 w-4" />;
      case "edit":
        return <Pencil className="h-4 w-4" />;
    }
  };

  const getPermissionLabel = (perm: Permission) => {
    switch (perm) {
      case "view":
        return "View Only";
      case "annotate":
        return "Can Comment";
      case "edit":
        return "Can Edit";
    }
  };

  const isShareExpired = (share: SessionShare) => {
    if (!share.expires_at) return false;
    return new Date(share.expires_at) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Share Session
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for "{sessionTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Permission selection */}
          <div className="space-y-3">
            <Label>Permission Level</Label>
            <RadioGroup
              value={permission}
              onValueChange={(v) => setPermission(v as Permission)}
              className="grid grid-cols-3 gap-2"
            >
              <Label
                htmlFor="view"
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                  permission === "view"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="view" id="view" className="sr-only" />
                <Eye className="h-5 w-5" />
                <span className="text-xs font-medium">View Only</span>
                <span className="text-[10px] text-muted-foreground text-center">
                  Watch & playback
                </span>
              </Label>

              <Label
                htmlFor="annotate"
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                  permission === "annotate"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="annotate" id="annotate" className="sr-only" />
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs font-medium">Can Comment</span>
                <span className="text-[10px] text-muted-foreground text-center">
                  Add feedback
                </span>
              </Label>

              <Label
                htmlFor="edit"
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                  permission === "edit"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="edit" id="edit" className="sr-only" />
                <Pencil className="h-5 w-5" />
                <span className="text-xs font-medium">Can Edit</span>
                <span className="text-[10px] text-muted-foreground text-center">
                  Full access
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* Expiration settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="expires" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Link Expiration
              </Label>
              <Switch
                id="expires"
                checked={expiresEnabled}
                onCheckedChange={setExpiresEnabled}
              />
            </div>
            {expiresEnabled && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(parseInt(e.target.value) || 7)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
                <span className="text-xs text-muted-foreground">
                  (expires {format(addDays(new Date(), expiresDays), "MMM d, yyyy")})
                </span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <Button
            onClick={handleCreateShare}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Generate Share Link
              </>
            )}
          </Button>

          {/* Generated link display */}
          {generatedLink && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-vantage-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Existing shares */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Active Share Links ({existingShares.length})
            </Label>

            {loadingShares ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : existingShares.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No share links created yet
              </p>
            ) : (
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {existingShares.map((share) => (
                    <div
                      key={share.id}
                      className={`flex items-center justify-between p-2 rounded-lg border ${
                        isShareExpired(share)
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getPermissionIcon(share.permission)}
                        <span className="text-xs font-medium">
                          {getPermissionLabel(share.permission)}
                        </span>
                        {isShareExpired(share) && (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {share.expires_at ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Clock className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Expires {format(new Date(share.expires_at), "MMM d, yyyy")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        <span>
                          {formatDistanceToNow(new Date(share.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
