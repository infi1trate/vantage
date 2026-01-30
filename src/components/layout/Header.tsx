import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User } from "lucide-react";
import { toast } from "sonner";

export function Header() {
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <header className="h-14 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo - text only, bold condensed */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl tracking-wide text-primary">
            VANTAGE
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link 
            to="/" 
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
          >
            Dashboard
          </Link>
          <Link 
            to="/library" 
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
          >
            Library
          </Link>
          <Link 
            to="/insights" 
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
          >
            Insights
          </Link>
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8 border border-primary/30">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium text-sm">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
