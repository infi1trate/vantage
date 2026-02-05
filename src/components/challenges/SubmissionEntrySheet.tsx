import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Video, Library, ArrowRight } from "lucide-react";
import { type Challenge } from "@/lib/challenges";

interface SubmissionEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge;
  onSelectFromLibrary: () => void;
}

export function SubmissionEntrySheet({
  open,
  onOpenChange,
  challenge,
  onSelectFromLibrary,
}: SubmissionEntrySheetProps) {
  const navigate = useNavigate();

  const handleRecordNew = () => {
    // Navigate to capture with challenge context
    onOpenChange(false);
    navigate("/dashboard", { 
      state: { 
        challengeId: challenge.id,
        challengeTitle: challenge.title 
      } 
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[50vh] rounded-t-xl">
        <SheetHeader className="text-left pb-6">
          <SheetTitle className="font-display text-2xl">
            Submit to "{challenge.title}"
          </SheetTitle>
          <SheetDescription>
            Choose how you want to create your submission
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
          {/* Record New */}
          <Button
            variant="outline"
            size="lg"
            className="h-auto p-6 flex flex-col items-start gap-3 text-left"
            onClick={handleRecordNew}
          >
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold flex items-center gap-2">
                Record New Clip
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Start a new recording session for this challenge
              </p>
            </div>
          </Button>

          {/* Select from Library */}
          <Button
            variant="outline"
            size="lg"
            className="h-auto p-6 flex flex-col items-start gap-3 text-left"
            onClick={() => {
              onOpenChange(false);
              onSelectFromLibrary();
            }}
          >
            <div className="h-12 w-12 rounded-lg bg-secondary/50 flex items-center justify-center">
              <Library className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <div className="font-semibold flex items-center gap-2">
                Choose from Library
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Select an existing clip from your recordings
              </p>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
