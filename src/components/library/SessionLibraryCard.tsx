import { useState } from "react";
import { SessionWithAssets, deleteSessionPermanently } from "@/lib/sessionLibrary";
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
import { ExportDrawer, ExportTab } from "@/components/export/ExportDrawer";
import { 
  Play, 
  MoreVertical, 
  Trash2, 
  Eye, 
  Share2,
  Download,
  Gamepad2,
  Mic,
  Video,
  Camera,
  MessageSquare,
  Lock,
  Globe,
  Link as LinkIcon,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface SessionLibraryCardProps {
  session: SessionWithAssets;
  onDeleted: () => void;
  viewMode: "grid" | "list";
}

export function SessionLibraryCard({ session, onDeleted, viewMode }: SessionLibraryCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportDrawerOpen, setExportDrawerOpen] = useState(false);
  const [exportDefaultTab, setExportDefaultTab] = useState<ExportTab>("export");

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const statusConfig = {
    recording: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Recording" },
    processing: { color: "bg-vantage-warning/20 text-vantage-warning border-vantage-warning/30", label: "Processing" },
    ready: { color: "bg-vantage-success/20 text-vantage-success border-vantage-success/30", label: "Ready" },
    failed: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Failed" },
  };

  const visibilityConfig = {
    private: { icon: Lock, label: "Private" },
    unlisted: { icon: LinkIcon, label: "Unlisted" },
    public: { icon: Globe, label: "Public" },
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSessionPermanently(session.id);
      toast.success("Session deleted permanently");
      onDeleted();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete session");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const VisibilityIcon = visibilityConfig[session.visibility].icon;

  if (viewMode === "list") {
    return (
      <>
        <Card className="group flex items-center gap-4 p-4 bg-card border-border/50 hover:border-primary/50 transition-all">
          {/* Thumbnail */}
          <Link to={`/session/${session.id}`} className="shrink-0">
            <div className="w-40 aspect-video relative bg-muted/50 rounded-lg overflow-hidden">
              {session.thumbnail_url ? (
                <img src={session.thumbnail_url} alt={session.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-card">
                  <Gamepad2 className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm">
                <span className="text-xs font-mono-data font-medium">{formatDuration(session.duration_seconds)}</span>
              </div>
            </div>
          </Link>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <Link to={`/session/${session.id}`}>
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {session.title}
              </h3>
            </Link>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {session.game_name && (
                <span className="flex items-center gap-1">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  {session.game_name}
                </span>
              )}
              <span>{format(new Date(session.created_at), "MMM d, yyyy")}</span>
            </div>
            
            {/* Capture types */}
            <div className="flex items-center gap-2 mt-2">
              {session.has_video && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Video className="h-3 w-3" /> Video
                </Badge>
              )}
              {session.has_microphone && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Mic className="h-3 w-3" /> Mic
                </Badge>
              )}
              {session.has_facecam && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Camera className="h-3 w-3" /> Facecam
                </Badge>
              )}
              {session.annotation_count > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <MessageSquare className="h-3 w-3" /> {session.annotation_count}
                </Badge>
              )}
            </div>
          </div>

          {/* Status & Privacy */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={statusConfig[session.status].color}>
              {session.status === "recording" && <span className="w-2 h-2 rounded-full bg-destructive mr-1.5 recording-pulse" />}
              {statusConfig[session.status].label}
            </Badge>
            <div className="flex items-center gap-1 text-muted-foreground" title={visibilityConfig[session.visibility].label}>
              <VisibilityIcon className="h-4 w-4" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link to={`/session/${session.id}`}>
                <Play className="h-4 w-4 mr-1" />
                Open
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/session/${session.id}`}>
                    <Eye className="h-4 w-4 mr-2" /> View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setExportDefaultTab("export");
                  setExportDrawerOpen(true);
                }}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setExportDefaultTab("community");
                  setExportDrawerOpen(true);
                }}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
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

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session Permanently?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>This will permanently delete <strong>"{session.title}"</strong> and all associated data:</p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Video recordings and thumbnails</li>
                  <li>Audio tracks (microphone, game audio)</li>
                  <li>Facecam recordings</li>
                  <li>All annotations and voice notes</li>
                  <li>AI analysis results</li>
                  <li>Comments and shares</li>
                </ul>
                <p className="font-medium text-destructive">This action cannot be undone.</p>
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
                    Delete Permanently
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Grid view
  return (
    <>
      <Card className="group relative overflow-hidden bg-card border-border/50 hover:border-primary/50 transition-all duration-300 card-hover">
        <Link to={`/session/${session.id}`}>
          {/* Thumbnail */}
          <div className="aspect-video relative bg-muted/50 overflow-hidden">
            {session.thumbnail_url ? (
              <img src={session.thumbnail_url} alt={session.title} className="w-full h-full object-cover" />
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
              <span className="text-xs font-mono-data font-medium">{formatDuration(session.duration_seconds)}</span>
            </div>

            {/* Status badge */}
            <div className="absolute top-2 left-2">
              <Badge variant="outline" className={statusConfig[session.status].color}>
                {session.status === "recording" && <span className="w-2 h-2 rounded-full bg-destructive mr-1.5 recording-pulse" />}
                {statusConfig[session.status].label}
              </Badge>
            </div>

            {/* Privacy indicator */}
            <div className="absolute top-2 right-2 p-1.5 rounded bg-background/80 backdrop-blur-sm">
              <VisibilityIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </Link>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/session/${session.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {session.title}
              </h3>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/session/${session.id}`}>
                    <Eye className="h-4 w-4 mr-2" /> View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setExportDefaultTab("export");
                  setExportDrawerOpen(true);
                }}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setExportDefaultTab("community");
                  setExportDrawerOpen(true);
                }}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
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
            {session.game_name && (
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                {session.game_name}
              </span>
            )}
            <span>{formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</span>
          </div>

          {/* Capture type icons */}
          <div className="flex items-center gap-2 mt-3">
            {session.has_video && (
              <div className="p-1.5 rounded bg-muted/50" title="Video">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            {session.has_microphone && (
              <div className="p-1.5 rounded bg-muted/50" title="Microphone">
                <Mic className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            {session.has_facecam && (
              <div className="p-1.5 rounded bg-muted/50" title="Facecam">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            {session.annotation_count > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-muted/50" title="Annotations">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{session.annotation_count}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will permanently delete <strong>"{session.title}"</strong> and all associated data:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>Video recordings and thumbnails</li>
                <li>Audio tracks (microphone, game audio)</li>
                <li>Facecam recordings</li>
                <li>All annotations and voice notes</li>
                <li>AI analysis results</li>
                <li>Comments and shares</li>
              </ul>
              <p className="font-medium text-destructive">This action cannot be undone.</p>
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
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Drawer */}
      <ExportDrawer
        open={exportDrawerOpen}
        onOpenChange={setExportDrawerOpen}
        defaultTab={exportDefaultTab}
        sessionId={session.id}
        sessionTitle={session.title}
      />
    </>
  );
}
