/**
 * Admin Challenges Page
 * 
 * Admin panel for managing challenges. Protected route - requires isChallengeAdmin.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trophy, 
  Plus, 
  Settings2,
  ArrowLeft,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminChallenges() {
  const { user, loading, isChallengeAdmin } = useAuth();
  const navigate = useNavigate();

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !isChallengeAdmin)) {
      toast.error("You don't have access to this page.");
      navigate("/settings", { replace: true });
    }
  }, [loading, user, isChallengeAdmin, navigate]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show 403 if not admin (fallback before redirect)
  if (!isChallengeAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the challenge admin panel.
            </p>
            <Button onClick={() => navigate("/settings")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Header */}
      <div className="border-b border-border/30 bg-card/30">
        <div className="container py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => navigate("/settings")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Button>
            <span>/</span>
            <span>Admin</span>
            <span>/</span>
            <span className="text-foreground">Challenges</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold">Challenge Admin</h1>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    Admin
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create, manage, and judge challenges
                </p>
              </div>
            </div>
            
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Challenge
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container flex-1 py-8">
        {/* Placeholder content - to be expanded */}
        <div className="rounded-lg border border-border/50 bg-card/50 p-8 text-center">
          <Settings2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Challenge Management</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            This admin panel will allow you to create, edit, publish, and judge challenges.
            Features coming soon.
          </p>
        </div>
      </main>
    </div>
  );
}
