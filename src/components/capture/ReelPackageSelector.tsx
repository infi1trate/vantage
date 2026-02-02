/**
 * Reel Package Selector
 * 
 * UI component for selecting and previewing AI reel packages.
 * Mobile-optimized with large touch targets.
 */

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  Check,
  ChevronRight,
  Palette,
  Volume2,
  Wand2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REEL_PACKAGES, ReelPackage } from "@/lib/effectMetadataStore";

interface ReelPackageSelectorProps {
  /** Currently selected package ID */
  selectedPackageId?: string;
  /** Callback when package is selected */
  onSelect: (packageId: string) => void;
  /** Optional: Show preview on select */
  onPreview?: (packageId: string) => void;
  /** Compact mode (for inline display) */
  compact?: boolean;
  /** Additional classes */
  className?: string;
}

export const ReelPackageSelector = memo(function ReelPackageSelector({
  selectedPackageId,
  onSelect,
  onPreview,
  compact = false,
  className,
}: ReelPackageSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Reel Packages</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {REEL_PACKAGES.length} available
        </span>
      </div>
      
      {/* Package List */}
      <ScrollArea className={compact ? "h-48" : "h-auto max-h-80"}>
        <div className="space-y-2 pr-3">
          {REEL_PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              isSelected={selectedPackageId === pkg.id}
              isHovered={hoveredId === pkg.id}
              onSelect={() => onSelect(pkg.id)}
              onPreview={onPreview ? () => onPreview(pkg.id) : undefined}
              onHover={() => setHoveredId(pkg.id)}
              onLeave={() => setHoveredId(null)}
              compact={compact}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

interface PackageCardProps {
  package: ReelPackage;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onPreview?: () => void;
  onHover: () => void;
  onLeave: () => void;
  compact: boolean;
}

const PackageCard = memo(function PackageCard({
  package: pkg,
  isSelected,
  isHovered,
  onSelect,
  onPreview,
  onHover,
  onLeave,
  compact,
}: PackageCardProps) {
  // Count enabled effects
  const sfxCount = Object.values(pkg.sfxMappings).filter((s) => s?.enabled).length;
  const vfxCount = Object.values(pkg.vfxMappings).filter((v) => v?.enabled).length;
  
  return (
    <button
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border/50 hover:border-border hover:bg-muted/30",
        compact ? "min-h-16" : "min-h-20"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail / Icon */}
        <div className={cn(
          "shrink-0 rounded-lg flex items-center justify-center",
          isSelected ? "bg-primary/20" : "bg-muted",
          compact ? "w-10 h-10" : "w-12 h-12"
        )}>
          <Wand2 className={cn(
            isSelected ? "text-primary" : "text-muted-foreground",
            compact ? "h-5 w-5" : "h-6 w-6"
          )} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium truncate",
              compact ? "text-sm" : "text-base"
            )}>
              {pkg.name}
            </span>
            {isSelected && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </div>
          
          {!compact && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {pkg.description}
            </p>
          )}
          
          {/* Effect indicators */}
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1">
              <Palette className="h-3 w-3" />
              Frame
            </Badge>
            {sfxCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1">
                <Volume2 className="h-3 w-3" />
                {sfxCount} SFX
              </Badge>
            )}
            {vfxCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1">
                <Sparkles className="h-3 w-3" />
                {vfxCount} VFX
              </Badge>
            )}
          </div>
        </div>
        
        {/* Preview button */}
        {onPreview && (isHovered || isSelected) && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Tags */}
      {!compact && (
        <div className="flex flex-wrap gap-1 mt-2">
          {pkg.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
});

export default ReelPackageSelector;
