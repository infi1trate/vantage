/**
 * Public Post Warning Dialog
 * Warns users before publishing publicly with sensitive content
 */

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
import { Badge } from "@/components/ui/badge";
import { Mic, Camera, AlertTriangle } from "lucide-react";

interface PublicPostWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  hasMic: boolean;
  hasWebcam: boolean;
}

export function PublicPostWarning({
  open,
  onOpenChange,
  onConfirm,
  hasMic,
  hasWebcam,
}: PublicPostWarningProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Confirm Public Post
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This video contains personal content that will be publicly visible:
            </p>
            <div className="flex flex-wrap gap-2">
              {hasMic && (
                <Badge variant="secondary" className="gap-1">
                  <Mic className="h-3 w-3" />
                  Voice / Microphone
                </Badge>
              )}
              {hasWebcam && (
                <Badge variant="secondary" className="gap-1">
                  <Camera className="h-3 w-3" />
                  Webcam / Facecam
                </Badge>
              )}
            </div>
            <p className="text-sm">
              Are you sure you want to make this post <strong>Public</strong>? 
              Anyone can view public posts.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, Post Publicly
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
