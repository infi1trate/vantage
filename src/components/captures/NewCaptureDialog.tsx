import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createCaptureSession } from "@/lib/captures";
import { runCapturePreflightGate, type PreflightGateResult } from "@/lib/capturePreflightGate";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Video, 
  AlertTriangle, 
  XCircle, 
  AlertCircle,
  Chrome,
  Globe,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface NewCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POPULAR_GAMES = [
  "Valorant",
  "Counter-Strike 2",
  "Apex Legends",
  "Overwatch 2",
  "Call of Duty: Warzone",
  "Fortnite",
  "Rainbow Six Siege",
  "PUBG",
  "Other",
];

type DialogView = "preflight" | "form" | "not_supported";

export function NewCaptureDialog({ open, onOpenChange }: NewCaptureDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [view, setView] = useState<DialogView>("preflight");
  const [preflightResult, setPreflightResult] = useState<PreflightGateResult | null>(null);
  const [title, setTitle] = useState("");
  const [gameName, setGameName] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Run preflight check when dialog opens
  useEffect(() => {
    if (open) {
      const result = runCapturePreflightGate();
      setPreflightResult(result);
      
      if (result.supported) {
        // All checks passed - show form
        setView("form");
      } else {
        // Browser not supported - show error screen
        setView("not_supported");
      }
    } else {
      // Reset state when dialog closes
      setView("preflight");
      setTitle("");
      setGameName("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a session title");
      return;
    }

    setLoading(true);
    try {
      const session = await createCaptureSession(
        user.id,
        title.trim(),
        gameName || undefined
      );
      
      toast.success("Capture session created!");
      onOpenChange(false);
      navigate(`/capture/${session.id}`);
    } catch (error: any) {
      console.error("Error creating session:", error);
      toast.error(error.message || "Failed to create capture session");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!preflightResult) return;
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      browser: preflightResult.browserInfo,
      issues: preflightResult.issues,
      selectedFormat: preflightResult.selectedFormat,
      supported: preflightResult.supported,
      canPreview: preflightResult.canPreview,
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      toast.success("Diagnostics copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Loading/checking view
  if (view === "preflight") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md glass-strong">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Checking browser compatibility...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Browser not supported view
  if (view === "not_supported" && preflightResult) {
    const criticalIssues = preflightResult.issues.filter(i => i.severity === "critical");
    const warnings = preflightResult.issues.filter(i => i.severity === "warning");
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg glass-strong">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Browser Not Supported</DialogTitle>
                <DialogDescription>
                  Your browser is missing capabilities required for capture.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Detected Browser */}
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>
                Detected: <strong>{preflightResult.browserInfo.name} {preflightResult.browserInfo.version}</strong>
              </span>
            </div>

            {/* Critical Issues */}
            {criticalIssues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wider text-destructive">
                  Missing Capabilities
                </h4>
                {criticalIssues.map(issue => (
                  <div 
                    key={issue.id}
                    className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm"
                  >
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-destructive">{issue.title}</span>
                      <p className="text-xs text-muted-foreground">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wider text-warning">
                  Warnings
                </h4>
                {warnings.map(issue => (
                  <div 
                    key={issue.id}
                    className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded text-sm"
                  >
                    <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-warning">{issue.title}</span>
                      <p className="text-xs text-muted-foreground">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommended Browsers */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recommended Browsers
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Chrome className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Chrome</span>
                  <Badge variant="outline" className="text-[9px] bg-vantage-success/10 text-vantage-success">Best</Badge>
                </a>
                <a
                  href="https://www.microsoft.com/edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Globe className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Edge</span>
                </a>
                <a
                  href="https://brave.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Globe className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Brave</span>
                </a>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {preflightResult.canPreview && (
              <Button
                variant="outline"
                onClick={() => setView("form")}
                className="w-full sm:w-auto"
              >
                Continue in Preview Mode
                <Badge variant="outline" className="ml-2 text-[9px]">No Recording</Badge>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleCopyDiagnostics}
              className="w-full sm:w-auto"
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy Diagnostics"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Normal form view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-strong">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            New Capture Session
          </DialogTitle>
          <DialogDescription>
            Start a new gameplay recording session. You can add annotations and voice notes during or after capture.
          </DialogDescription>
        </DialogHeader>

        {/* Show warning if there are any issues but we're proceeding anyway */}
        {preflightResult && preflightResult.issues.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded text-sm">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-medium text-warning">Limited Support</span>
              <p className="text-xs text-muted-foreground">
                Some features may not work as expected in your browser.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Session Title</Label>
            <Input
              id="title"
              placeholder="e.g., Ranked Valorant - Bind"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/50"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="game">Game (optional)</Label>
            <Select value={gameName} onValueChange={setGameName} disabled={loading}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {POPULAR_GAMES.map((game) => (
                  <SelectItem key={game} value={game}>
                    {game}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Start Capture"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
