import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  AlertTriangle,
  Video,
  Mic,
  MessageSquare,
  Brain,
  PenTool,
  FileAudio,
  CheckCircle,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteSessionDialog({
  open,
  onOpenChange,
  sessionTitle,
  onConfirmDelete,
  isDeleting,
}: DeleteSessionDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [understandPermanent, setUnderstandPermanent] = useState(false);

  const itemsToDelete = [
    { icon: Video, label: "Video recordings", color: "text-primary" },
    { icon: Mic, label: "Audio tracks", color: "text-accent" },
    { icon: FileAudio, label: "Voice notes", color: "text-vantage-success" },
    { icon: MessageSquare, label: "Comments & reactions", color: "text-vantage-warning" },
    { icon: PenTool, label: "Drawings & annotations", color: "text-vantage-purple" },
    { icon: Brain, label: "AI analysis results", color: "text-destructive" },
  ];

  const canDelete = confirmText === "DELETE" && understandPermanent;

  const handleDelete = async () => {
    if (canDelete) {
      await onConfirmDelete();
      // Reset state
      setConfirmText("");
      setUnderstandPermanent(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmText("");
      setUnderstandPermanent(false);
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <Badge variant="destructive" className="text-xs">
              Permanent Action
            </Badge>
          </div>
          <AlertDialogTitle>Delete Session Permanently</AlertDialogTitle>
          <AlertDialogDescription>
            You're about to permanently delete "{sessionTitle}" and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* What will be deleted */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Everything will be deleted
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {itemsToDelete.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <item.icon className={cn("h-4 w-4", item.color)} />
                  <span className="text-xs">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Privacy assurance */}
          <div className="p-3 rounded-lg bg-vantage-success/5 border border-vantage-success/20">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-vantage-success mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-vantage-success">Complete data removal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All files will be permanently erased from our servers. No backups or copies will remain. 
                  This action is irreversible and cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Confirmation */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="understand"
                checked={understandPermanent}
                onCheckedChange={(checked) => setUnderstandPermanent(!!checked)}
                className="mt-1"
              />
              <Label htmlFor="understand" className="text-sm cursor-pointer">
                I understand this action is <strong>permanent and irreversible</strong>. 
                All data associated with this session will be completely removed.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm">
                Type <code className="px-1.5 py-0.5 rounded bg-muted font-mono">DELETE</code> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type DELETE"
                className={cn(
                  "font-mono",
                  confirmText === "DELETE" && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            className={cn(
              "w-full sm:w-auto bg-destructive hover:bg-destructive/90",
              !canDelete && "opacity-50 cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              "Deleting..."
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
