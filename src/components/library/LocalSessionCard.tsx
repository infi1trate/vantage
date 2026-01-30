import { useState } from "react";
import { LocalSession, deleteLocalSession, getLocalSessionBlob, formatBytes } from "@/lib/localSessionStorage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Play, 
  MoreVertical, 
  Trash2, 
  Download,
  Gamepad2,
  Mic,
  Video,
  Camera,
  Volume2,
  Lock,
  Loader2,
  HardDrive
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface LocalSessionCardProps {
  session: LocalSession;
  onDeleted: () => void;
  viewMode: "grid" | "list";
}

export function LocalSessionCard({ session, onDeleted, viewMode }: LocalSessionCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlay = async () => {
    try {
      const blob = await getLocalSessionBlob(session.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setShowPlayerDialog(true);
      } else {
        toast.error("Video not found");
      }
    } catch (error) {
      console.error("Failed to load video:", error);
      toast.error("Failed to load video");
    }
  };

  const handleClosePlayer = () => {
    setShowPlayerDialog(false);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await getLocalSessionBlob(session.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${session.title.replace(/[^a-z0-9]/gi, "_")}_${format(new Date(session.createdAt), "yyyy-MM-dd")}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Download started");
      } else {
        toast.error("Video not found");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download video");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteLocalSession(session.id);
      toast.success("Session deleted");
      onDeleted();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete session");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (viewMode === "list") {
    return (
      <>
        <Card className="group flex items-center gap-4 p-4 bg-card border-border/50 hover:border-primary/50 transition-all">
          {/* Thumbnail */}
          <button onClick={handlePlay} className="shrink-0 cursor-pointer">
            <div className="w-40 aspect-video relative bg-muted/50 rounded-lg overflow-hidden">
              {session.thumbnailDataUrl ? (
                <img src={session.thumbnailDataUrl} alt={session.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-card">
                  <Gamepad2 className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm">
                <span className="text-xs font-mono-data font-medium">{formatDuration(session.duration)}</span>
              </div>
              {/* Play overlay */}
              <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" fill="currentColor" />
              </div>
            </div>
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <button onClick={handlePlay} className="text-left w-full">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {session.title}
              </h3>
            </button>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {session.gameName && (
                <span className="flex items-center gap-1">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  {session.gameName}
                </span>
              )}
              <span>{format(new Date(session.createdAt), "MMM d, yyyy")}</span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {formatBytes(session.blobSize)}
              </span>
            </div>
            
            {/* Capture types */}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <Video className="h-3 w-3" /> Video
              </Badge>
              {session.hasMic && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Mic className="h-3 w-3" /> Mic
                </Badge>
              )}
              {session.hasCam && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Camera className="h-3 w-3" /> Cam
                </Badge>
              )}
              {session.hasSystemAudio && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Volume2 className="h-3 w-3" /> Audio
                </Badge>
              )}
            </div>
          </div>

          {/* Status & Privacy */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-vantage-success/20 text-vantage-success border-vantage-success/30">
              Local
            </Badge>
            <div className="flex items-center gap-1 text-muted-foreground" title="Private">
              <Lock className="h-4 w-4" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePlay}>
              <Play className="h-4 w-4 mr-1" />
              Play
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePlay}>
                  <Play className="h-4 w-4 mr-2" /> Play
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>"{session.title}"</strong> from your local storage.
                <br /><br />
                <strong className="text-destructive">This action cannot be undone.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Video Player Dialog */}
        <Dialog open={showPlayerDialog} onOpenChange={handleClosePlayer}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>{session.title}</DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-black">
              {videoUrl && (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Grid view
  return (
    <>
      <Card className="group relative overflow-hidden bg-card border-border/50 hover:border-primary/50 transition-all duration-300 card-hover">
        <button onClick={handlePlay} className="w-full text-left">
          {/* Thumbnail */}
          <div className="aspect-video relative bg-muted/50 overflow-hidden">
            {session.thumbnailDataUrl ? (
              <img src={session.thumbnailDataUrl} alt={session.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-card">
                <Gamepad2 className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            
            {/* Play overlay */}
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="p-4 rounded-full bg-primary/90 glow-primary">
                <Play className="h-8 w-8 text-primary-foreground" fill="currentColor" />
              </div>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm">
              <span className="text-xs font-mono-data font-medium">{formatDuration(session.duration)}</span>
            </div>

            {/* Local badge */}
            <div className="absolute top-2 left-2">
              <Badge variant="outline" className="bg-vantage-success/20 text-vantage-success border-vantage-success/30">
                Local
              </Badge>
            </div>

            {/* Privacy indicator */}
            <div className="absolute top-2 right-2 p-1.5 rounded bg-background/80 backdrop-blur-sm">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </button>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <button onClick={handlePlay} className="flex-1 min-w-0 text-left">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {session.title}
              </h3>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePlay}>
                  <Play className="h-4 w-4 mr-2" /> Play
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {session.gameName && (
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                {session.gameName}
              </span>
            )}
            <span>{formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
          </div>

          <div className="flex items-center justify-between mt-3">
            {/* Capture type icons */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-muted/50" title="Video">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {session.hasMic && (
                <div className="p-1.5 rounded bg-muted/50" title="Microphone">
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {session.hasCam && (
                <div className="p-1.5 rounded bg-muted/50" title="Camera">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {session.hasSystemAudio && (
                <div className="p-1.5 rounded bg-muted/50" title="System Audio">
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
            
            {/* Size */}
            <span className="text-xs text-muted-foreground">{formatBytes(session.blobSize)}</span>
          </div>
        </div>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>"{session.title}"</strong> from your local storage.
              <br /><br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Player Dialog */}
      <Dialog open={showPlayerDialog} onOpenChange={handleClosePlayer}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{session.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-black">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
