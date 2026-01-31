import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CloudIcon, X } from "lucide-react";
import { isDropboxConnected } from "@/lib/dropboxSync";

const DISMISSED_KEY = "vantage_dropbox_promo_dismissed";

export function DropboxPromoBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkVisibility = async () => {
      // Check if permanently dismissed
      const dismissed = localStorage.getItem(DISMISSED_KEY) === "true";
      if (dismissed) {
        setChecking(false);
        return;
      }

      // Check if Dropbox is already connected
      try {
        const connected = await isDropboxConnected();
        if (!connected) {
          setVisible(true);
        }
      } catch (error) {
        // Don't show banner on error
        console.warn("[DropboxPromoBanner] Failed to check connection:", error);
      }
      
      setChecking(false);
    };

    checkVisibility();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  const handleConnect = () => {
    navigate("/settings?tab=connected-accounts");
  };

  if (checking || !visible) {
    return null;
  }

  return (
    <div className="mb-6 px-4 py-3 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <CloudIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Protect your library</p>
          <p className="text-xs text-muted-foreground truncate">
            Back up your recordings automatically by connecting Dropbox.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleConnect}
        >
          Connect Dropbox
        </Button>
      </div>
    </div>
  );
}
