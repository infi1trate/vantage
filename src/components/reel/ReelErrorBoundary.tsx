/**
 * Reel Error Boundary
 * 
 * Catches errors in the reel creation/editing flow and shows
 * a recoverable UI with "Return to Library" option.
 * 
 * This prevents the entire app from going black if something
 * fails during reel processing.
 */

import { Component, ReactNode } from "react";
import { AlertCircle, ArrowLeft, RefreshCw, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Fallback URL to navigate to on error (default: /library) */
  fallbackUrl?: string;
  /** Optional session ID for navigation */
  sessionId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ReelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error("[ReelErrorBoundary] Caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ReelErrorBoundary] Error details:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Force re-render by updating key (parent should handle this)
    window.location.reload();
  };

  handleNavigate = () => {
    const { fallbackUrl = "/library", sessionId } = this.props;
    
    // If we have a session ID, offer to go back to session
    if (sessionId) {
      window.location.href = `/session/${sessionId}`;
    } else {
      window.location.href = fallbackUrl;
    }
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const { sessionId } = this.props;
      
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
            {/* Icon */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <Film className="h-10 w-10 text-destructive/40" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
            
            {/* Message */}
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                Reel couldn't be loaded
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Something went wrong while loading this reel. Your work may be saved automatically.
              </p>
              {error && import.meta.env.DEV && (
                <p className="text-xs font-mono text-destructive/70 bg-destructive/5 p-2 rounded mt-4">
                  {error.message}
                </p>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={this.handleRetry} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={this.handleNavigate}
                className="w-full gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {sessionId ? "Return to Session" : "Return to Library"}
              </Button>
            </div>
            
            {/* Help text */}
            <p className="text-xs text-muted-foreground">
              If this keeps happening, try refreshing the page or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
