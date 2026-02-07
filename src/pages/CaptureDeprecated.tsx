/**
 * Web Capture Deprecation Gate
 * 
 * Web-based screen recording has been deprecated.
 * This component redirects any attempt to access old capture routes
 * to the /download page with an informational toast.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function CaptureDeprecated() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.info("Capture now happens in the Vantage Desktop app.", {
      duration: 5000,
    });
    navigate("/download", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
