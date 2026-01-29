import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createCaptureSession } from "@/lib/captures";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Video } from "lucide-react";
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

export function NewCaptureDialog({ open, onOpenChange }: NewCaptureDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [gameName, setGameName] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle("");
      setGameName("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              onClick={() => handleOpenChange(false)}
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
