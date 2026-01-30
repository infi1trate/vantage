import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportDrawer, ExportTab, ExportOptions } from "./ExportDrawer";
import { Download, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportCTAsProps {
  sessionId: string;
  sessionTitle: string;
  onExport?: (options: ExportOptions) => void;
  variant?: "header" | "floating";
  className?: string;
}

/**
 * Export/Share CTA buttons with responsive behavior
 * - Desktop (header variant): sits in top-right of content header
 * - Mobile (floating variant): sticky at bottom, above scrubber
 */
export function ExportCTAs({
  sessionId,
  sessionTitle,
  onExport,
  variant = "header",
  className,
}: ExportCTAsProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<ExportTab>("export");

  const handleExportClick = () => {
    setDefaultTab("export");
    setDrawerOpen(true);
  };

  const handleShareClick = () => {
    setDefaultTab("community");
    setDrawerOpen(true);
  };

  if (variant === "floating") {
    return (
      <>
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-40 p-3 pb-safe",
            "bg-background/95 backdrop-blur-md border-t border-border/50",
            // Positioned above timeline scrubber - assumes scrubber is ~60px
            "lg:hidden",
            className
          )}
          style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button
              onClick={handleShareClick}
              variant="outline"
              className="flex-1 gap-2 h-12"
              size="lg"
            >
              <Share2 className="h-5 w-5" />
              <span className="font-medium">Share</span>
            </Button>
            <Button
              onClick={handleExportClick}
              className="flex-1 gap-2 h-12"
              size="lg"
            >
              <Download className="h-5 w-5" />
              <span className="font-medium">Export</span>
            </Button>
          </div>
        </div>

        <ExportDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          defaultTab={defaultTab}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          onExport={onExport}
        />
      </>
    );
  }

  // Header variant (desktop)
  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          onClick={handleShareClick}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </Button>
        <Button
          onClick={handleExportClick}
          size="sm"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </Button>
      </div>

      <ExportDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        defaultTab={defaultTab}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        onExport={onExport}
      />
    </>
  );
}
