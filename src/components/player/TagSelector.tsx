import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, X, Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags?: string[];
}

// Predefined game-relevant tags
const PRESET_TAGS = {
  Gameplay: [
    "clutch",
    "ace",
    "1v2",
    "1v3",
    "1v4",
    "1v5",
    "eco",
    "force-buy",
    "retake",
    "post-plant",
    "entry",
    "lurk",
    "rotate",
  ],
  Mechanics: [
    "aim",
    "crosshair",
    "movement",
    "spray-control",
    "flick",
    "tracking",
    "peek",
    "jiggle",
    "counter-strafe",
  ],
  Utility: [
    "smoke",
    "flash",
    "molly",
    "grenade",
    "lineup",
    "fake",
    "execute",
    "default",
  ],
  Communication: [
    "callout",
    "igl",
    "info",
    "timing",
    "trade",
    "bait",
    "teamplay",
  ],
  Review: [
    "mistake",
    "improvement",
    "good-play",
    "positioning",
    "decision",
    "timing-error",
    "whiff",
  ],
  Priority: [
    "critical",
    "important",
    "minor",
    "question",
    "practice",
    "coach-review",
  ],
};

const TAG_COLORS: Record<string, string> = {
  // Gameplay
  clutch: "bg-vantage-purple",
  ace: "bg-accent",
  "1v2": "bg-vantage-purple/80",
  "1v3": "bg-vantage-purple/80",
  "1v4": "bg-vantage-purple/80",
  "1v5": "bg-vantage-purple",
  // Priority
  critical: "bg-destructive",
  important: "bg-vantage-warning",
  minor: "bg-muted",
  question: "bg-primary",
  // Review
  mistake: "bg-destructive/80",
  improvement: "bg-vantage-success",
  "good-play": "bg-vantage-success",
};

export function TagSelector({
  selectedTags,
  onTagsChange,
  availableTags = [],
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const allTags = [
    ...new Set([
      ...Object.values(PRESET_TAGS).flat(),
      ...availableTags,
    ]),
  ];

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    const tag = customTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
      setCustomTag("");
    }
  };

  const getTagColor = (tag: string) => {
    return TAG_COLORS[tag] || "bg-primary/50";
  };

  return (
    <div className="space-y-2">
      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn("text-xs gap-1", getTagColor(tag), "text-white")}
            >
              {tag}
              <button
                onClick={() => handleToggleTag(tag)}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Tag className="h-3 w-3" />
            Add Tags
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-center text-sm text-muted-foreground">
                  No tags found. Add a custom tag below.
                </div>
              </CommandEmpty>

              {Object.entries(PRESET_TAGS).map(([category, tags]) => (
                <CommandGroup key={category} heading={category}>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleToggleTag(tag)}
                    >
                      <div
                        className={cn(
                          "mr-2 h-4 w-4 rounded border flex items-center justify-center",
                          selectedTags.includes(tag)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {selectedTags.includes(tag) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="flex-1">{tag}</span>
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          getTagColor(tag)
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>

          {/* Custom tag input */}
          <div className="p-2 border-t border-border">
            <div className="flex gap-2">
              <Input
                placeholder="Custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                className="h-8"
                onClick={handleAddCustomTag}
                disabled={!customTag.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
