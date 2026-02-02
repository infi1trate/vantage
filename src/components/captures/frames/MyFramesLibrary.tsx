/**
 * My Frames Library
 * 
 * Mini-library for saved signature frames.
 * Supports Apply, Edit, Delete, and Set as Default.
 */

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Bookmark,
  Check,
  Edit2,
  Trash2,
  Star,
  StarOff,
  Loader2,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { toast } from "sonner";
import { 
  useUserFrameOverlays,
  useDeleteFrameOverlay,
  useSetDefaultFrame,
  type FrameOverlay,
  type FrameStyleParams,
} from "@/hooks/useFrameOverlays";

interface MyFramesLibraryProps {
  /** Currently selected frame ID */
  selectedFrameId: string | null;
  /** User's default frame ID */
  defaultFrameId: string | null;
  /** Called when user applies a frame */
  onApply: (frame: FrameOverlay) => void;
  /** Called when user wants to edit a frame (opens fine-tune) */
  onEdit: (frame: FrameOverlay) => void;
  /** Called when user saves current config as new frame */
  onSaveNew: () => void;
  /** Called when default changes */
  onDefaultChange: (frameId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export const MyFramesLibrary = memo(function MyFramesLibrary({
  selectedFrameId,
  defaultFrameId,
  onApply,
  onEdit,
  onSaveNew,
  onDefaultChange,
  disabled = false,
  className,
}: MyFramesLibraryProps) {
  const { data: frames, isLoading } = useUserFrameOverlays();
  const deleteFrame = useDeleteFrameOverlay();
  const setDefaultFrame = useSetDefaultFrame();

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const frameToDelete = frames?.find((f) => f.id === deleteConfirmId);

  const handleSetDefault = async (frameId: string | null) => {
    try {
      await setDefaultFrame.mutateAsync(frameId);
      onDefaultChange(frameId);
      toast.success(frameId ? "Default frame set" : "Default frame cleared");
    } catch {
      toast.error("Failed to update default");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteFrame.mutateAsync(deleteConfirmId);
      toast.success("Frame deleted");
      
      // Clear default if deleted frame was default
      if (defaultFrameId === deleteConfirmId) {
        onDefaultChange(null);
      }
    } catch {
      toast.error("Failed to delete frame");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const savedFrames = frames?.filter((f) => f.session_id === null) || [];

  if (savedFrames.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <EmptyState onSaveNew={onSaveNew} disabled={disabled} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">My Frames</span>
          <span className="text-xs text-muted-foreground">
            ({savedFrames.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveNew}
          disabled={disabled}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Save Current
        </Button>
      </div>

      {/* Frame List */}
      <ScrollArea className="h-[200px]">
        <div className="space-y-2 pr-2">
          {savedFrames.map((frame) => (
            <FrameCard
              key={frame.id}
              frame={frame}
              isSelected={selectedFrameId === frame.id}
              isDefault={defaultFrameId === frame.id}
              onApply={() => onApply(frame)}
              onEdit={() => onEdit(frame)}
              onDelete={() => setDeleteConfirmId(frame.id)}
              onSetDefault={() => handleSetDefault(
                defaultFrameId === frame.id ? null : frame.id
              )}
              disabled={disabled}
              isSettingDefault={setDefaultFrame.isPending}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Frame</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{frameToDelete?.name || "Untitled"}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFrame.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

interface FrameCardProps {
  frame: FrameOverlay;
  isSelected: boolean;
  isDefault: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  disabled: boolean;
  isSettingDefault: boolean;
}

const FrameCard = memo(function FrameCard({
  frame,
  isSelected,
  isDefault,
  onApply,
  onEdit,
  onDelete,
  onSetDefault,
  disabled,
  isSettingDefault,
}: FrameCardProps) {
  const colorVar = getColorVar(frame.style_params.colorTheme);
  const shapeClass = getShapeClass(frame.style_params.shape);
  const glowIntensity = frame.style_params.glowIntensity || 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border/30 hover:border-border/50 hover:bg-muted/10"
      )}
    >
      {/* Preview Thumbnail */}
      <div
        className={cn(
          "shrink-0 w-10 h-10 flex items-center justify-center bg-muted/30",
          shapeClass
        )}
        style={{
          borderWidth: frame.style_params.strokeWidth || 0,
          borderColor: colorVar,
          borderStyle: "solid",
          boxShadow: glowIntensity > 0
            ? `0 0 ${glowIntensity * 8}px ${glowIntensity * 3}px ${colorVar}`
            : undefined,
        }}
      >
        <div className={cn("w-2/3 h-2/3 bg-muted-foreground/20", shapeClass)} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">
            {frame.name || "Untitled"}
          </span>
          {isDefault && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {frame.type === "ai" ? "AI Generated" : frame.preset_key ? "Preset" : "Custom"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Set Default */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault();
          }}
          disabled={disabled || isSettingDefault}
          className={cn(
            "p-1.5 rounded-md transition-all",
            isDefault
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          title={isDefault ? "Remove as default" : "Set as default"}
        >
          {isSettingDefault ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isDefault ? (
            <Star className="h-3.5 w-3.5 fill-current" />
          ) : (
            <StarOff className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Edit */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          disabled={disabled}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
          title="Edit frame"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={disabled}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Delete frame"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Apply */}
        <Button
          size="sm"
          variant={isSelected ? "default" : "outline"}
          onClick={onApply}
          disabled={disabled || isSelected}
          className="h-7 px-2 text-xs ml-1"
        >
          {isSelected ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Applied
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </div>
  );
});

interface EmptyStateProps {
  onSaveNew: () => void;
  disabled: boolean;
}

const EmptyState = memo(function EmptyState({ onSaveNew, disabled }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-muted/20 mb-3">
        <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">
        No saved frames yet
      </p>
      <p className="text-xs text-muted-foreground/60 mb-4 max-w-[200px]">
        Customize a frame and save it to your library for quick access
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onSaveNew}
        disabled={disabled}
        className="text-xs"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Save Current as Frame
      </Button>
    </div>
  );
});

function getColorVar(theme: string): string {
  const colors: Record<string, string> = {
    primary: "hsl(65 70% 45%)",
    white: "#ffffff",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    "neon-pink": "#ff00ff",
    "neon-cyan": "#00ffff",
    "neon-green": "#00ff00",
    "retro-green": "#00ff00",
  };
  return colors[theme] || colors.primary;
}

function getShapeClass(shape: string): string {
  switch (shape) {
    case "circle": return "rounded-full";
    case "hex": return "clip-path-hex";
    case "square": return "rounded-none";
    case "pill": return "rounded-full";
    default: return "rounded-xl";
  }
}

export default MyFramesLibrary;
